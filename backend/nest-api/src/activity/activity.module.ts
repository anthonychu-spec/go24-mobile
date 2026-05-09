import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { PgmModule } from '../pgm-adapter/pgm.module';
import { PgmBookingAdapter } from '../booking/pgm-booking.adapter';
import { ActivityService } from './activity.service';
import { ActivityController } from './activity.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Booking]), PgmModule],
  providers: [ActivityService, PgmBookingAdapter],
  controllers: [ActivityController],
})
export class ActivityModule {}
