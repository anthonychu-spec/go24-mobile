import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceToken } from './entities/device-token.entity';
import { User } from '../auth/entities/user.entity';

// Reason → Chinese message mapping
const REASON_MESSAGES: Record<string, { title: string; body: string }> = {
  'No Active Contract': {
    title: '⚠️ 入場失敗',
    body: '你嘅會籍已到期，請於 App 內續會或聯絡前台。',
  },
  'Frozen': {
    title: '⚠️ 入場失敗',
    body: '你嘅會籍暫時凍結，請聯絡前台查詢。',
  },
  'Debit': {
    title: '⚠️ 入場失敗',
    body: '帳戶有未付款項，請更新信用卡或聯絡前台。',
  },
  'Wrong Club': {
    title: '⚠️ 入場失敗',
    body: '你嘅會籍不適用於此分店，請到指定分店。',
  },
  'Recovery': {
    title: '⚠️ 入場失敗',
    body: '入場驗證失敗，請聯絡前台協助。',
  },
};

const DEFAULT_MESSAGE = {
  title: '⚠️ 入場失敗',
  body: '無法驗證入場資格，請聯絡前台查詢。',
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(DeviceToken) private readonly tokenRepo: Repository<DeviceToken>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async registerToken(userId: string, token: string, platform: string): Promise<void> {
    await this.tokenRepo.upsert(
      { userId, token, platform: platform as 'ios' | 'android' | 'web' },
      { conflictPaths: ['userId', 'token'] },
    );
  }

  async handleCheckinFailed(input: {
    memberNumber: string;
    reason: string;
    club: string;
    timestamp: string;
  }): Promise<void> {
    // Find user by PGM member code
    const user = await this.userRepo
      .createQueryBuilder('u')
      .where('u.pgm_member_id::text = :num OR u.member_code = :num', { num: input.memberNumber })
      .getOne();

    if (!user) {
      this.logger.warn(`checkin-failed: no user found for member ${input.memberNumber}`);
      return;
    }

    const tokens = await this.tokenRepo.find({ where: { userId: user.id } });
    if (tokens.length === 0) {
      this.logger.log(`checkin-failed: user ${user.id} has no device tokens`);
      return;
    }

    const msg = REASON_MESSAGES[input.reason] ?? DEFAULT_MESSAGE;
    await this.sendPush(tokens.map(t => t.token), msg.title, msg.body, {
      reason: input.reason,
      club: input.club,
      timestamp: input.timestamp,
    });
  }

  private async sendPush(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, string>,
  ): Promise<void> {
    // Use Expo Push API directly (no SDK needed on server)
    const messages = tokens.map(to => ({ to, title, body, data, sound: 'default' }));

    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
      });
      const json = await res.json() as any;
      this.logger.log(`Push sent to ${tokens.length} device(s)`, json?.data?.[0]?.status);
    } catch (err) {
      this.logger.error('Push notification failed', err);
    }
  }
}
