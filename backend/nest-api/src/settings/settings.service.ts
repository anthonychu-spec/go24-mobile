import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSettings } from './entities/user-settings.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(UserSettings) private readonly repo: Repository<UserSettings>,
  ) {}

  async get(userId: string): Promise<UserSettings> {
    const existing = await this.repo.findOne({ where: { userId } });
    if (existing) return existing;
    // Return defaults without persisting
    const defaults = new UserSettings();
    defaults.userId             = userId;
    defaults.reminderMinutes    = 60;
    defaults.autoWaitlistCancel = false;
    return defaults;
  }

  async update(
    userId: string,
    patch: Partial<Pick<UserSettings, 'reminderMinutes' | 'autoWaitlistCancel'>>,
  ): Promise<UserSettings> {
    await this.repo.upsert({ userId, ...patch }, ['userId']);
    return this.get(userId);
  }
}
