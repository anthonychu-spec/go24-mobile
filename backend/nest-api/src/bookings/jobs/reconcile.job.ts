import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { BookingRepository } from '../repositories/booking.repo';
import { IdempotencyRepository } from '../repositories/idempotency.repo';

@Injectable()
export class ReconcileJob {
  private readonly logger = new Logger(ReconcileJob.name);

  constructor(
    private readonly bookingRepo: BookingRepository,
    private readonly idempotencyRepo: IdempotencyRepository,
    @InjectRepository(OutboxEvent) private readonly outbox: Repository<OutboxEvent>,
  ) {}

  @Cron('0 */5 * * * *') // every 5 minutes
  async reconcilePendingVerify(): Promise<void> {
    const bookings = await this.bookingRepo.findPendingVerify();
    if (bookings.length === 0) return;
    this.logger.log(`Reconciling ${bookings.length} pending_verify bookings`);

    for (const booking of bookings) {
      try {
        // We don't have pgmId on the booking entity — use userId as fallback approach
        // In production, store pgmMemberId on booking row
        // For now, treat > 30 min as failed
        const ageMin = (Date.now() - booking.updatedAt.getTime()) / 60_000;
        if (ageMin > 30) {
          await this.bookingRepo.transition(booking.id, 'failed', { errorCode: 'RECONCILE_TIMEOUT' }, 'reconcile: too old');
          this.logger.warn(`Booking ${booking.id} timed out in pending_verify`);
        }
      } catch (err) {
        this.logger.error(`Reconcile failed for booking ${booking.id}`, err);
      }
    }
  }

  @Cron('0 */5 * * * *') // same interval — also clear stale pending
  async reconcileStalePending(): Promise<void> {
    const stale = await this.bookingRepo.findStalePending(180); // > 3 min
    for (const booking of stale) {
      this.logger.warn(`Stale pending booking ${booking.id} — marking failed`);
      await this.bookingRepo.transition(booking.id, 'failed', { errorCode: 'STALE_PENDING' }, 'reconcile: stale pending');
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
