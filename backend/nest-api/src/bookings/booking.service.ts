import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BOOKING_REPO, IBookingRepo } from '../booking/booking.interfaces';
import { BookingStatus } from './entities/booking.entity';
import { OutboxEvent } from './entities/outbox-event.entity';
import { BookingRepository } from './repositories/booking.repo';
import { IdempotencyRepository } from './repositories/idempotency.repo';
import {
  BookingFullError, DuplicateBookingError, InProgressError,
  isTempFail, mapPgmError,
} from './errors/index';

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
  ) {}

  async book(input: BookInput): Promise<BookResult> {
    // 1. Atomic idempotency claim
    const claim = await this.idempotencyRepo.tryClaim(
      input.userId, input.idempotencyKey, 'POST /bookings',
    );

    if (claim.kind === 'already_done') {
      return claim.response as BookResult;
    }
    if (claim.kind === 'in_flight') {
      throw new InProgressError();
    }

    // 2. Create pending booking record
    const booking = await this.bookingRepo.create({
      userId: input.userId,
      pgmMemberId: input.pgmId,
      classId: input.classId,
      idempotencyKey: input.idempotencyKey,
      status: 'pending',
    });

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
    return bookings;
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

  private async emitOutbox(topic: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await this.outbox.save(this.outbox.create({ topic, payload }));
    } catch (err) {
      this.logger.error('Failed to write outbox event', err);
    }
  }
}
