import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pool } from 'pg';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from '../auth/entities/user.entity';
import { PgmModule } from '../pgm-adapter/pgm.module';
import { PgmBookingAdapter } from '../booking/pgm-booking.adapter';
import { ActivityService } from './activity.service';
import { ActivityController } from './activity.controller';
import { GYM_DATA_POOL } from './activity.constants';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, User]), PgmModule],
  providers: [
    ActivityService,
    PgmBookingAdapter,
    {
      provide: GYM_DATA_POOL,
      useFactory: () => process.env.GYM_DATA_URL
        ? new Pool({ connectionString: process.env.GYM_DATA_URL })
        : null,
    },
  ],
  controllers: [ActivityController],
})
export class ActivityModule {}
