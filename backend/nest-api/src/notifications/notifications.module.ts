import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceToken } from './entities/device-token.entity';
import { Notification } from './entities/notification.entity';
import { User } from '../auth/entities/user.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PgmModule } from '../pgm-adapter/pgm.module';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceToken, Notification, User]), PgmModule],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],   // exported so BookingsService can call notifyBookingConfirmed
})
export class NotificationsModule {}
