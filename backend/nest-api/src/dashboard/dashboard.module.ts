import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { PgmModule } from '../pgm-adapter/pgm.module';
import { BookingModule } from '../booking/booking.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Booking]), PgmModule, BookingModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
