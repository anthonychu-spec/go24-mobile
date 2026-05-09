import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemberMilestone, MILESTONE_LEVELS, MILESTONE_META } from './entities/member-milestone.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MilestonesService {
  private readonly logger = new Logger(MilestonesService.name);

  constructor(
    @InjectRepository(MemberMilestone) private readonly repo: Repository<MemberMilestone>,
    private readonly notifications: NotificationsService,
  ) {}

  async checkAndAward(userId: string, totalVisits: number): Promise<void> {
    for (const level of MILESTONE_LEVELS) {
      if (totalVisits < level) continue;

      const existing = await this.repo.findOne({ where: { userId, milestone: level } });
      if (existing) continue;

      const m = this.repo.create({ userId, milestone: level, unlockedAt: new Date() });
      await this.repo.save(m);

      const meta = MILESTONE_META[level];
      this.logger.log(`Milestone ${level} awarded to ${userId}`);

      await this.notifications.sendDirectPush(
        userId,
        `${meta.emoji} ${meta.title}`,
        meta.message,
        { type: 'milestone', level },
      ).catch(() => {});
    }
  }

  listMilestones(userId: string): Promise<MemberMilestone[]> {
    return this.repo.find({ where: { userId }, order: { milestone: 'ASC' } });
  }
}
