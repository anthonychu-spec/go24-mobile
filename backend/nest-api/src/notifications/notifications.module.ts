import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceToken } from './entities/device-token.entity';
import { User } from '../auth/entities/user.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceToken, User])],
  providers: [NotificationsService],
  controllers: [NotificationsController],
})
export class NotificationsModule {}
