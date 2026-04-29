import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PgmModule } from '../pgm-adapter/pgm.module';
import { BOOKING_REPO } from '../booking/booking.interfaces';
import { PgmBookingAdapter } from '../booking/pgm-booking.adapter';
import { Booking } from './entities/booking.entity';
import { BookingEvent } from './entities/booking-event.entity';
import { IdempotencyKey } from './entities/idempotency-key.entity';
import { OutboxEvent } from './entities/outbox-event.entity';
import { BookingRepository } from './repositories/booking.repo';
import { IdempotencyRepository } from './repositories/idempotency.repo';
import { BookingsService } from './booking.service';
import { BookingsController } from './booking.controller';
import { ReconcileJob } from './jobs/reconcile.job';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, BookingEvent, IdempotencyKey, OutboxEvent]),
    PgmModule,
  ],
  providers: [
    { provide: BOOKING_REPO, useClass: PgmBookingAdapter },
    PgmBookingAdapter,
    BookingRepository,
    IdempotencyRepository,
    BookingsService,
    ReconcileJob,
  ],
  controllers: [BookingsController],
})
export class BookingsModule {}
