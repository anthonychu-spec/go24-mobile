import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DevtoolsModule } from '@nestjs/devtools-integration';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { BookingModule } from './booking/booking.module';
import { BookingsModule } from './bookings/booking.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    ScheduleModule.forRoot(),
    AuthModule,
    HealthModule,
    BookingModule,
    BookingsModule,
    PaymentsModule,
    NotificationsModule,
    MetricsModule,
    DevtoolsModule.register({
      http: process.env.NODE_ENV !== 'production',
      port: 8000,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
