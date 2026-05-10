import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pool } from 'pg';
import { Booking } from '../bookings/entities/booking.entity';
import { PgmModule } from '../pgm-adapter/pgm.module';
import { PgmBookingAdapter } from '../booking/pgm-booking.adapter';
import { ActivityService } from './activity.service';
import { ActivityController } from './activity.controller';

export const GYM_DATA_POOL = 'GYM_DATA_POOL';

@Module({
  imports: [TypeOrmModule.forFeature([Booking]), PgmModule],
  providers: [
    ActivityService,
    PgmBookingAdapter,
    {
      provide: GYM_DATA_POOL,
      useFactory: () => new Pool({ connectionString: process.env.GYM_DATA_URL }),
    },
  ],
  controllers: [ActivityController],
})
export class ActivityModule {}
