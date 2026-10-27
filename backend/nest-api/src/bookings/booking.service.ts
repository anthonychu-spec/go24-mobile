import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BOOKING_REPO } from '../booking/booking.interfaces';
import type { IBookingRepo } from '../booking/booking.interfaces';
import { BookingStatus } from './entities/booking.entity';
import { OutboxEvent } from './entities/outbox-event.entity';
import { BookingRepository } from './repositories/booking.repo';
import { IdempotencyRepository } from './repositories/idempotency.repo';
import {
  BookingFullError, ClassNotFoundError, DailyLimitError, DuplicateBookingError, InProgressError,
  OutsideBookingWindowError,
  isTempFail, mapPgmError,
} from './errors/index';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { backgroundJobsEnabled } from '../config/background-jobs';
import { BrandService } from '../brand/brand.service';
import type { BrandId } from '../brand/brand.constants';

/** YYYY-MM-DD of an instant in Hong Kong (the clubs' calendar day) */
export function hkDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(iso));
}

/** errorCode markers that tell ReconcileJob what to check in PGM */
export const WAITLIST_DECLINED = 'WAITLIST_DECLINED';
export const CANCEL_UNKNOWN = 'CANCEL_UNKNOWN';
/** Booking of a deleted account: no PGM member id any more, so it can't be reconciled */
export const ACCOUNT_DELETED = 'ACCOUNT_DELETED';

export interface BookInput {
  userId: string;
  pgmId: number;        // PGM member id for the PGM call
  classId: number;
  idempotencyKey: string;
  acceptWaitlist?: boolean;
  brand: BrandId;       // only the brand's own clubs can be booked
}

export interface BookResult {
  success: boolean;
  bookingId: string;
  status: string;
  waitlistPosition?: number;
  error?: string;
}

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly bookingRepo: BookingRepository,
    private readonly idempotencyRepo: IdempotencyRepository,
    @Inject(BOOKING_REPO) private readonly pgm: IBookingRepo,
    @InjectRepository(OutboxEvent) private readonly outbox: Repository<OutboxEvent>,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
    private readonly brands: BrandService,
  ) {}

  private static readonly BOOKING_WINDOW_MS = 168 * 3600_000; // 168 hours

  async book(input: BookInput): Promise<BookResult> {
    // 0. Enforce 168-hour booking window
    const cls = await this.pgm.getClass(input.classId);
    if (!(await this.brands.ownsClub(input.brand, cls.clubId))) throw new ClassNotFoundError();
    const startMs = new Date(cls.startTime).getTime();
    if (startMs > Date.now() + BookingsService.BOOKING_WINDOW_MS) {
      throw new OutsideBookingWindowError();
    }

    // 0b. Class date for daily limit (DB unique index enforces 1-per-day) — the Hong Kong
    // calendar day, not UTC: a 06:30 HKT class is still the previous day in UTC
    const classDate = hkDate(cls.startTime);

    // 1. Atomic idempotency claim
    const claim = await this.idempotencyRepo.tryClaim(
      input.userId, input.idempotencyKey, 'POST /bookings',
    );

    if (claim.kind === 'already_done') {
      return claim.response as unknown as BookResult;
    }
    if (claim.kind === 'in_flight') {
      throw new InProgressError();
    }

    // 2. Create pending booking record (DB unique index on user_id + class_date prevents > 1/day)
    let booking;
    try {
      booking = await this.bookingRepo.create({
        userId: input.userId,
        pgmMemberId: input.pgmId,
        classId: input.classId,
        clubId: cls.clubId,
        classDate,
        className: cls.name,
        clubName: cls.clubName ?? null,
        startTime: cls.startTime,
        idempotencyKey: input.idempotencyKey,
        status: 'pending',
      });
    } catch (err: any) {
      if (err?.driverError?.code === '23505' && err?.driverError?.constraint === 'idx_one_booking_per_day') {
        // Settle the idempotency key, or a retry with it would get 409 IN_PROGRESS until it expires
        await this.idempotencyRepo.complete(
          input.userId, input.idempotencyKey, { success: false, error: 'DAILY_LIMIT' } as any, 'terminal',
        );
        throw new DailyLimitError();
      }
      throw err;
    }

    try {
      // 3. Call PGM — authoritative source (Phase 1)
      const pgmResult = await this.pgm.bookClass(input.pgmId, input.classId);

      if (pgmResult.isStandby) {
        // Waitlist path
        if (!input.acceptWaitlist) {
          // User did not accept waitlist → treat as full, and release the standby place
          // PGM just created so the member isn't left on a waitlist they declined.
          const response = await this.releaseDeclinedStandby(booking.id, pgmResult.bookingId);
          await this.idempotencyRepo.complete(input.userId, input.idempotencyKey, response as any, 'terminal');
          throw new BookingFullError();
        }
        await this.bookingRepo.transition(
          booking.id, 'waitlist',
          { externalId: String(pgmResult.bookingId), waitlistPosition: null },
          'PGM returned standby',
        );
        const response: BookResult = {
          success: true, bookingId: booking.id, status: 'waitlist',
          waitlistPosition: undefined,
        };
        await this.idempotencyRepo.complete(input.userId, input.idempotencyKey, response as any, 'terminal');
        await this.emitOutbox('booking.waitlisted', { bookingId: booking.id, classId: input.classId });
        return response;
      }

      // Confirmed path
      await this.bookingRepo.transition(
        booking.id, 'confirmed',
        { externalId: String(pgmResult.bookingId) },
        'PGM confirmed',
      );

      // 4. Shadow read — verify PGM actually registered the booking
      void this.shadowRead(booking.id, input.pgmId, pgmResult.bookingId);

      const response: BookResult = { success: true, bookingId: booking.id, status: 'confirmed' };
      await this.idempotencyRepo.complete(input.userId, input.idempotencyKey, response as any, 'terminal');
      await this.emitOutbox('booking.confirmed', { bookingId: booking.id, classId: input.classId });

      // Schedule class reminder push (non-blocking)
      void this.scheduleClassReminder(input.userId, input.classId, new Date(startMs), cls.name ?? `Class #${input.classId}`);

      return response;

    } catch (err) {
      // Don't double-handle errors we already threw intentionally
      if (err instanceof BookingFullError || err instanceof DuplicateBookingError || err instanceof InProgressError) {
        throw err;
      }

      const errorCode = mapPgmError(err);
      const finalStatus: BookingStatus = isTempFail(errorCode) ? 'pending_verify' : 'failed';

      await this.bookingRepo.transition(booking.id, finalStatus, { errorCode }, `PGM error: ${errorCode}`);

      const response: BookResult = { success: false, bookingId: booking.id, status: finalStatus, error: errorCode };
      const resultKind = finalStatus === 'pending_verify' ? 'transient' : 'terminal';
      await this.idempotencyRepo.complete(input.userId, input.idempotencyKey, response as any, resultKind);

      throw err;
    }
  }

  /**
   * PGM put the member on standby but they declined the waitlist. Cancel that one
   * standby booking; if PGM doesn't answer, leave it for reconcile (pending_verify)
   * rather than claiming it's gone.
   */
  /** The booking's club belongs to the caller's brand (looked up in PGM for rows saved before club_id existed). */
  private async bookingInBrand(booking: { clubId: number | null; classId: number }, brand: BrandId): Promise<boolean> {
    if (booking.clubId != null) return this.brands.ownsClub(brand, booking.clubId);
    const cls = await this.pgm.getClass(booking.classId).catch(() => null);
    return this.brands.ownsClub(brand, cls?.clubId);
  }

  private async releaseDeclinedStandby(bookingId: string, pgmBookingId: number): Promise<BookResult> {
    try {
      await this.pgm.cancelBooking(pgmBookingId);
      await this.bookingRepo.transition(
        bookingId, 'failed', { externalId: String(pgmBookingId), errorCode: 'BOOKING_FULL' },
        'standby declined and released',
      );
      return { success: false, bookingId, status: 'failed', error: 'BOOKING_FULL' };
    } catch (err) {
      this.logger.warn(`Could not release declined standby ${pgmBookingId} for booking ${bookingId}: ${mapPgmError(err)}`);
      await this.bookingRepo.transition(
        bookingId, 'pending_verify', { externalId: String(pgmBookingId), errorCode: WAITLIST_DECLINED },
        'standby declined, release failed',
      );
      return { success: false, bookingId, status: 'pending_verify', error: 'BOOKING_FULL' };
    }
  }

  async cancel(bookingId: string, userId: string, idempotencyKey: string, brand: BrandId): Promise<void> {
    const claim = await this.idempotencyRepo.tryClaim(
      userId, idempotencyKey, 'DELETE /bookings',
    );
    if (claim.kind === 'already_done') return;
    if (claim.kind === 'in_flight') throw new InProgressError();

    const booking = await this.bookingRepo.findById(bookingId);
    if (!booking || booking.userId !== userId || !(await this.bookingInBrand(booking, brand))) {
      throw new BadRequestException('Booking not found');
    }

    if (booking.externalId) {
      try {
        await this.pgm.cancelBooking(Number(booking.externalId));
      } catch (err) {
        const errorCode = mapPgmError(err);
        if (isTempFail(errorCode)) {
          // PGM may or may not have cancelled it. Keep the booking as is, flag it for
          // reconcile, and let the client retry with a new key once it has settled.
          await this.bookingRepo.flagError(booking.id, CANCEL_UNKNOWN);
          await this.idempotencyRepo.complete(userId, idempotencyKey, { cancelled: false, error: errorCode }, 'transient');
        }
        throw err;
      }
    }

    await this.bookingRepo.transition(booking.id, 'cancelled', {}, 'user cancel', userId);
    await this.idempotencyRepo.complete(userId, idempotencyKey, { cancelled: true }, 'terminal');
    await this.emitOutbox('booking.cancelled', { bookingId, classId: booking.classId });
  }

  async listMine(userId: string, brand: BrandId, status?: string): Promise<object[]> {
    const clubs = new Set(await this.brands.clubIds(brand));
    const bookings = await this.bookingRepo.findByUser(userId, status);
    // Enrich with PGM class details (name, club, times)
    const enriched = await Promise.all(
      bookings.map(async (b) => {
        try {
          const cls = await this.pgm.getClass(b.classId);
          if (!clubs.has(b.clubId ?? cls.clubId)) return null;
          return {
            ...b,
            className: cls.name,
            clubName: cls.clubName,
            startTime: cls.startTime,
            endTime: cls.endTime,
            instructorName: cls.instructorName,
          };
        } catch {
          // Class no longer in PGM's window: keep it only if we know it was this brand's club
          if (b.clubId == null || !clubs.has(b.clubId)) return null;
          return { ...b, className: null, clubName: null, startTime: null, endTime: null, instructorName: null };
        }
      }),
    );
    return enriched.filter(Boolean) as object[];
  }

  private async shadowRead(bookingId: string, pgmId: number, externalBookingId: number): Promise<void> {
    const check = async (attempt: number): Promise<void> => {
      try {
        await new Promise(r => setTimeout(r, 2000 * attempt));
        const pgmBookings = await this.pgm.listMyBookings(pgmId);
        const found = pgmBookings.some(b => b.bookingId === externalBookingId);
        if (!found) {
          // Alert ops — do NOT change state (confirmed is terminal; reconcile handles this separately)
          this.logger.error({ event: 'pgm_ghost_booking', bookingId, externalBookingId,
            message: 'Booking confirmed locally but not found in PGM. Manual review required.' });
        }
      } catch (err) {
        if (attempt < 3) return check(attempt + 1);
        this.logger.warn(`Shadow read failed after 3 attempts for booking ${bookingId}`);
      }
    };
    void check(1);
  }

  // ── PGM webhook handlers ──────────────────────────────────────────────

  /** PGM ClassesBookingCancelled — system/instructor cancel */
  async handlePgmCancelled(pgmBookingId: number): Promise<void> {
    const booking = await this.bookingRepo.findByExternalId(String(pgmBookingId));
    if (!booking) {
      this.logger.warn(`PGM cancel webhook: no local booking for externalId=${pgmBookingId}`);
      return;
    }
    if (booking.status === 'cancelled') return; // already cancelled

    await this.bookingRepo.transition(booking.id, 'cancelled', {}, 'pgm_webhook_cancel', 'system');
    await this.emitOutbox('booking.cancelled', { bookingId: booking.id, classId: booking.classId, source: 'pgm_webhook' });
    this.logger.log(`PGM cancel webhook: booking ${booking.id} cancelled (externalId=${pgmBookingId})`);
  }

  /** PGM ClassesBookingPromotedFromStandbyList — waitlist → confirmed */
  async handlePgmPromoted(pgmBookingId: number): Promise<void> {
    const booking = await this.bookingRepo.findByExternalId(String(pgmBookingId));
    if (!booking) {
      this.logger.warn(`PGM promoted webhook: no local booking for externalId=${pgmBookingId}`);
      return;
    }
    if (booking.status === 'confirmed') return; // already promoted

    await this.bookingRepo.transition(booking.id, 'confirmed', { waitlistPosition: null }, 'pgm_webhook_promoted', 'system');
    await this.emitOutbox('booking.confirmed', { bookingId: booking.id, classId: booking.classId, source: 'pgm_webhook' });
    this.logger.log(`PGM promoted webhook: booking ${booking.id} waitlist→confirmed (externalId=${pgmBookingId})`);
  }

  private async emitOutbox(topic: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await this.outbox.save(this.outbox.create({ topic, payload }));
    } catch (err) {
      this.logger.error('Failed to write outbox event', err);
    }
  }

  // ── Class reminder ────────────────────────────────────────────────────────

  private async scheduleClassReminder(
    userId: string,
    classId: number,
    classStart: Date,
    className: string,
  ): Promise<void> {
    try {
      const s = await this.settings.get(userId);
      if (s.reminderMinutes === 0) return;

      const fireAt = new Date(classStart.getTime() - s.reminderMinutes * 60_000);
      const delayMs = fireAt.getTime() - Date.now();
      if (delayMs <= 0) return; // already too close / past

      setTimeout(() => {
        void this.notifications.sendDirectPush(
          userId,
          '🏋️ Class starting soon',
          `${className} starts in ${s.reminderMinutes} minutes. See you there!`,
          { type: 'class_reminder', classId },
        ).catch(() => {});
      }, delayMs);
    } catch { /* non-fatal */ }
  }

  // ── Waitlist auto-cancel cron ─────────────────────────────────────────────

  @Cron('*/15 * * * *') // every 15 minutes
  async autoReleaseWaitlistSpots(): Promise<void> {
    if (!backgroundJobsEnabled()) return;
    const fiveHoursFromNow = new Date(Date.now() + 5 * 3600_000);
    try {
      const waitlisted = await this.bookingRepo.findByStatus('waitlist');
      for (const booking of waitlisted) {
        try {
          const cls = await this.pgm.getClass(booking.classId);
          const startTime = new Date(cls.startTime);
          if (startTime > fiveHoursFromNow) continue;

          const s = await this.settings.get(booking.userId);

          if (s.autoWaitlistCancel) {
            if (!booking.externalId) continue;
            await this.pgm.cancelBooking(Number(booking.externalId));
            await this.bookingRepo.transition(booking.id, 'cancelled', {}, 'auto waitlist cancel');
            await this.notifications.sendDirectPush(
              booking.userId,
              'Waitlist spot released',
              `Your waitlist spot for ${cls.name ?? `Class #${booking.classId}`} was auto-released (class in < 5h).`,
              { type: 'waitlist_auto_cancelled', classId: booking.classId },
            ).catch(() => {});
          } else {
            // Just remind — don't cancel
            await this.notifications.sendDirectPush(
              booking.userId,
              "⏰ You're confirmed!",
              `You're confirmed for ${cls.name ?? `Class #${booking.classId}`} starting soon. Cancel if you can't make it.`,
              { type: 'waitlist_reminder', classId: booking.classId },
            ).catch(() => {});
          }
        } catch { /* skip this booking */ }
      }
    } catch (err) {
      this.logger.error('autoReleaseWaitlistSpots error', err);
    }
  }
}
