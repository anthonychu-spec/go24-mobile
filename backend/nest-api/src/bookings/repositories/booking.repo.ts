import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { BookingEvent } from '../entities/booking-event.entity';
import { assertValidTransition } from '../state-machine/booking.states';

@Injectable()
export class BookingRepository {
  private readonly logger = new Logger(BookingRepository.name);

  constructor(
    @InjectRepository(Booking)   private readonly bookings: Repository<Booking>,
    @InjectRepository(BookingEvent) private readonly events: Repository<BookingEvent>,
  ) {}

  async create(input: {
    userId: string;
    pgmMemberId: number;
    classId: number;
    classDate?: string;
    idempotencyKey: string;
    status: BookingStatus;
  }): Promise<Booking> {
    const booking = this.bookings.create({
      userId: input.userId,
      pgmMemberId: input.pgmMemberId,
      classId: input.classId,
      classDate: input.classDate ?? null,
      idempotencyKey: input.idempotencyKey,
      status: input.status,
      source: 'local',
    });
    const saved = await this.bookings.save(booking);
    await this.logEvent(saved.id, null, input.status, 'init', 'system');
    return saved;
  }

  async transition(
    bookingId: string,
    to: BookingStatus,
    patch: Partial<Pick<Booking, 'externalId' | 'errorCode' | 'waitlistPosition'>> & Record<string, unknown>,
    reason?: string,
    actor = 'system',
  ): Promise<Booking> {
    const booking = await this.bookings.findOneOrFail({ where: { id: bookingId } });
    assertValidTransition(booking.status, to);
    const from = booking.status;
    Object.assign(booking, { ...patch, status: to, version: booking.version + 1 });
    const saved = await this.bookings.save(booking);
    await this.logEvent(bookingId, from, to, reason, actor);
    return saved;
  }

  async findById(id: string): Promise<Booking | null> {
    return this.bookings.findOne({ where: { id } });
  }

  async findByUser(userId: string, status?: string): Promise<Booking[]> {
    const qb = this.bookings.createQueryBuilder('b')
      .where('b.user_id = :userId', { userId })
      .orderBy('b.created_at', 'DESC')
      .limit(50);
    if (status) qb.andWhere('b.status = :status', { status });
    return qb.getMany();
  }

  async findStalePending(olderThanSeconds: number): Promise<Booking[]> {
    const cutoff = new Date(Date.now() - olderThanSeconds * 1000);
    return this.bookings.createQueryBuilder('b')
      .where('b.status = :s', { s: 'pending' })
      .andWhere('b.created_at < :cutoff', { cutoff })
      .getMany();
  }

  async findPendingVerify(): Promise<Booking[]> {
    return this.bookings.find({ where: { status: 'pending_verify' } });
  }

  private async logEvent(
    bookingId: string,
    from: BookingStatus | null,
    to: BookingStatus,
    reason?: string,
    actor?: string,
  ): Promise<void> {
    try {
      await this.events.save(
        this.events.create({ bookingId, fromState: from, toState: to, reason, actor }),
      );
    } catch (err) {
      this.logger.error('Failed to write booking_event', err);
    }
  }
}
