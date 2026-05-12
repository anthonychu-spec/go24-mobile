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
  BookingFullError, DuplicateBookingError, InProgressError,
  isTempFail, mapPgmError,
} from './errors/index';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';

export interface BookInput {
  userId: string;
  pgmId: number;        // PGM member id for the PGM call
  classId: number;
  idempotencyKey: string;
  acceptWaitlist?: boolean;
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
  ) {}

  private static readonly BOOKING_WINDOW_MS = 168 * 3600_000; // 168 hours

  async book(input: BookInput): Promise<BookResult> {
    // 0. Enforce 168-hour booking window
    const cls = await this.pgm.getClass(input.classId);
    const startMs = new Date(cls.startTime).getTime();
    if (startMs > Date.now() + BookingsService.BOOKING_WINDOW_MS) {
      throw new BadRequestException('Class is outside the 168-hour booking window');
    }

    // 0b. Class date for daily limit (DB unique index enforces 1-per-day)
    const classDate = new Date(cls.startTime).toISOString().slice(0, 10);

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
        classDate,
        className: cls.name,
        clubName: cls.clubName ?? null,
        startTime: cls.startTime,
        idempotencyKey: input.idempotencyKey,
        status: 'pending',
      });
    } catch (err: any) {
      if (err?.driverError?.code === '23505' && err?.driverError?.constraint === 'idx_one_booking_per_day') {
        throw new BadRequestException('Daily limit reached — you can only book 1 class per day');
      }
      throw err;
    }

    try {
      // 3. Call PGM — authoritative source (Phase 1)
      const pgmResult = await this.pgm.bookClass(input.pgmId, input.classId);

      if (pgmResult.isStandby) {
        // Waitlist path
        if (!input.acceptWaitlist) {
          // User did not accept waitlist → treat as full
          await this.bookingRepo.transition(booking.id, 'failed', { errorCode: 'BOOKING_FULL' });
          const response: BookResult = { success: false, bookingId: booking.id, status: 'failed', error: 'BOOKING_FULL' };
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

  async cancel(bookingId: string, userId: string, idempotencyKey: string): Promise<void> {
    const claim = await this.idempotencyRepo.tryClaim(
      userId, idempotencyKey, 'DELETE /bookings',
    );
    if (claim.kind === 'already_done') return;
    if (claim.kind === 'in_flight') throw new InProgressError();

    const booking = await this.bookingRepo.findById(bookingId);
    if (!booking || booking.userId !== userId) {
      throw new BadRequestException('Booking not found');
    }

    if (booking.externalId && booking.pgmMemberId) {
      await this.pgm.cancelBooking(booking.pgmMemberId, booking.classId);
    }

    await this.bookingRepo.transition(booking.id, 'cancelled', {}, 'user cancel', userId);
    await this.idempotencyRepo.complete(userId, idempotencyKey, { cancelled: true }, 'terminal');
    await this.emitOutbox('booking.cancelled', { bookingId, classId: booking.classId });
  }

  async listMine(userId: string, status?: string): Promise<object[]> {
    const bookings = await this.bookingRepo.findByUser(userId, status);
    // Enrich with PGM class details (name, club, times)
    const enriched = await Promise.all(
      bookings.map(async (b) => {
        try {
          const cls = await this.pgm.getClass(b.classId);
          return {
            ...b,
            className: cls.name,
            clubName: cls.clubName,
            startTime: cls.startTime,
            endTime: cls.endTime,
            instructorName: cls.instructorName,
          };
        } catch {
          return { ...b, className: null, clubName: null, startTime: null, endTime: null, instructorName: null };
        }
      }),
    );
    return enriched;
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

      setTimeout(async () => {
        await this.notifications.sendDirectPush(
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
            await this.pgm.cancelBooking(booking.pgmMemberId ?? 0, booking.classId);
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
              '⏰ You\'re confirmed!',
              `You\'re confirmed for ${cls.name ?? `Class #${booking.classId}`} starting soon. Cancel if you can\'t make it.`,
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
