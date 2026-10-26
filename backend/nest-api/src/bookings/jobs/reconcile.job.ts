import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BOOKING_REPO } from '../../booking/booking.interfaces';
import type { IBookingRepo, PgmClassBookingState } from '../../booking/booking.interfaces';
import { Booking } from '../entities/booking.entity';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { BookingRepository } from '../repositories/booking.repo';
import { IdempotencyRepository } from '../repositories/idempotency.repo';
import { CANCEL_UNKNOWN, WAITLIST_DECLINED } from '../booking.service';
import { backgroundJobsEnabled } from '../../config/background-jobs';

/**
 * Settles bookings whose outcome in PGM is unknown by asking PGM what it holds.
 * Never marks a booking failed without a successful PGM answer: when PGM can't be
 * reached, or holds more than one active booking for the class, the booking stays
 * "confirming" (pending_verify) and its id is the support reference.
 */
@Injectable()
export class ReconcileJob {
  private readonly logger = new Logger(ReconcileJob.name);

  constructor(
    private readonly bookingRepo: BookingRepository,
    private readonly idempotencyRepo: IdempotencyRepository,
    @Inject(BOOKING_REPO) private readonly pgm: IBookingRepo,
    @InjectRepository(OutboxEvent) private readonly outbox: Repository<OutboxEvent>,
  ) {}

  @Cron('0 */5 * * * *') // every 5 minutes
  async reconcilePendingVerify(): Promise<void> {
    if (!backgroundJobsEnabled()) return;
    const bookings = await this.bookingRepo.findPendingVerify();
    if (bookings.length === 0) return;
    this.logger.log(`Reconciling ${bookings.length} pending_verify bookings`);
    for (const booking of bookings) await this.settle(booking);
  }

  @Cron('0 */5 * * * *') // same interval — pending rows the request never finished (> 3 min)
  async reconcileStalePending(): Promise<void> {
    if (!backgroundJobsEnabled()) return;
    const stale = await this.bookingRepo.findStalePending(180);
    for (const booking of stale) await this.settle(booking);
  }

  @Cron('0 */5 * * * *') // cancels that timed out — did PGM cancel or not?
  async reconcileUnknownCancels(): Promise<void> {
    if (!backgroundJobsEnabled()) return;
    const bookings = await this.bookingRepo.findByErrorCode(CANCEL_UNKNOWN);
    for (const booking of bookings) await this.settleCancel(booking);
  }

  /** Decide pending / pending_verify from the member's PGM bookings for that class. */
  async settle(booking: Booking): Promise<void> {
    if (!booking.pgmMemberId) {
      this.logger.error(`Booking ${booking.id} has no PGM member id — needs manual review`);
      return;
    }

    let rows: PgmClassBookingState[];
    try {
      rows = await this.pgm.findMemberBookingsForClass(booking.pgmMemberId, booking.classId);
    } catch (err) {
      this.logger.warn(`Reconcile: PGM lookup failed for booking ${booking.id}; still confirming`);
      await this.keepConfirming(booking, 'RECONCILE_UNKNOWN', 'reconcile: PGM unreachable');
      return;
    }

    try {
      if (booking.errorCode === WAITLIST_DECLINED) {
        await this.releaseDeclinedStandby(booking, rows);
        return;
      }

      const active = rows.filter(r => !r.isCancelled);
      if (active.length === 1) {
        const [row] = active;
        await this.bookingRepo.transition(
          booking.id, row.isStandby ? 'waitlist' : 'confirmed',
          { externalId: String(row.bookingId), errorCode: null },
          'reconcile: found in PGM',
        );
        return;
      }
      if (active.length === 0) {
        await this.bookingRepo.transition(
          booking.id, 'failed', { errorCode: 'NOT_IN_PGM' }, 'reconcile: PGM has no active booking',
        );
        return;
      }
      this.logger.error(
        `Reconcile: booking ${booking.id} — PGM holds ${active.length} active bookings for class ${booking.classId}; needs manual review`,
      );
      await this.keepConfirming(booking, 'RECONCILE_AMBIGUOUS', 'reconcile: more than one active PGM booking');
    } catch (err) {
      this.logger.error(`Reconcile failed for booking ${booking.id}`, err);
    }
  }

  /** A cancel timed out: mark cancelled only if PGM shows it cancelled, otherwise clear the flag. */
  async settleCancel(booking: Booking): Promise<void> {
    if (!booking.externalId || !booking.pgmMemberId) {
      await this.bookingRepo.flagError(booking.id, null);
      return;
    }
    try {
      const rows = await this.pgm.findMemberBookingsForClass(booking.pgmMemberId, booking.classId);
      const row = rows.find(r => String(r.bookingId) === booking.externalId);
      if (!row || row.isCancelled) {
        await this.bookingRepo.transition(booking.id, 'cancelled', { errorCode: null }, 'reconcile: cancelled in PGM');
      } else {
        await this.bookingRepo.flagError(booking.id, null);
        this.logger.warn(`Reconcile: cancel of booking ${booking.id} did not take effect in PGM; booking stands`);
      }
    } catch (err) {
      this.logger.warn(`Reconcile: could not check cancel of booking ${booking.id}; will retry`);
    }
  }

  private async releaseDeclinedStandby(booking: Booking, rows: PgmClassBookingState[]): Promise<void> {
    const standby = rows.find(r => String(r.bookingId) === booking.externalId && !r.isCancelled);
    if (standby) {
      try {
        await this.pgm.cancelBooking(standby.bookingId);
      } catch {
        this.logger.warn(`Reconcile: still could not release declined standby for booking ${booking.id}`);
        return;
      }
    }
    await this.bookingRepo.transition(
      booking.id, 'failed', { errorCode: 'BOOKING_FULL' }, 'reconcile: declined standby released',
    );
  }

  /** Unknown outcome: pending moves to pending_verify ("confirming"); pending_verify stays put. */
  private async keepConfirming(booking: Booking, errorCode: string, reason: string): Promise<void> {
    if (booking.status === 'pending') {
      await this.bookingRepo.transition(booking.id, 'pending_verify', { errorCode }, reason);
    }
  }

  @Cron('0 */10 * * * *') // every 10 minutes — dispatch outbox events
  async dispatchOutbox(): Promise<void> {
    const undispatched = await this.outbox.find({
      where: { dispatchedAt: IsNull() },
      order: { createdAt: 'ASC' },
      take: 50,
    });
    if (undispatched.length === 0) return;

    this.logger.log(`Dispatching ${undispatched.length} outbox events`);
    for (const event of undispatched) {
      try {
        // TODO: Wire to actual notification service (WhatsApp / push)
        this.logger.log(`[outbox] ${event.topic}`, event.payload);
        await this.outbox.update(event.id, { dispatchedAt: new Date() });
      } catch (err) {
        this.logger.error(`Outbox dispatch failed for ${event.id}`, err);
      }
    }
  }

  @Cron('0 0 * * * *') // hourly — clean expired idempotency keys
  async cleanIdempotency(): Promise<void> {
    await this.idempotencyRepo.cleanExpired();
  }
}
