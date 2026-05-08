
import { Module } from '@nestjs/common';
import { PgmModule } from '../pgm-adapter/pgm.module';
import { BOOKING_REPO } from './booking.interfaces';
import { PgmBookingAdapter } from './pgm-booking.adapter';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';

@Module({
  imports: [PgmModule],
  providers: [
    { provide: BOOKING_REPO, useClass: PgmBookingAdapter },
    PgmBookingAdapter,
    BookingService,
  ],
  controllers: [BookingController],
  exports: [BOOKING_REPO, PgmBookingAdapter],
})
export class BookingModule {}
