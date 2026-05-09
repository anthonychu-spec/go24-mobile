import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberMilestone } from './entities/member-milestone.entity';
import { MilestonesService } from './milestones.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([MemberMilestone]), NotificationsModule],
  providers: [MilestonesService],
  exports: [MilestonesService],
})
export class MilestonesModule {}
