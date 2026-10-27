import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { DeviceToken } from './entities/device-token.entity';
import { Notification, NotificationType } from './entities/notification.entity';
import { User } from '../auth/entities/user.entity';
import { PgmClient } from '../pgm-adapter/pgm.client';
import { backgroundJobsEnabled } from '../config/background-jobs';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH = 100;

interface ExpoTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

/** Tokens whose ticket says the app is no longer installed (tickets come back in send order). */
export function deadTokens(tokens: string[], tickets: ExpoTicket[] | undefined): string[] {
  if (!tickets) return [];
  return tokens.filter((_, i) => tickets[i]?.status === 'error' && tickets[i]?.details?.error === 'DeviceNotRegistered');
}

const REASON_MESSAGES: Record<string, { title: string; body: string }> = {
  'No Active Contract': { title: '⚠️ 入場失敗', body: '你嘅會籍已到期，請於 App 內續會或聯絡前台。' },
  'Frozen':            { title: '⚠️ 入場失敗', body: '你嘅會籍暫時凍結，請聯絡前台查詢。' },
  'Debit':             { title: '⚠️ 入場失敗', body: '帳戶有未付款項，請更新信用卡或聯絡前台。' },
  'Wrong Club':        { title: '⚠️ 入場失敗', body: '你嘅會籍不適用於此分店，請到指定分店。' },
  'Recovery':          { title: '⚠️ 入場失敗', body: '入場驗證失敗，請聯絡前台協助。' },
};

const DEFAULT_ENTRY_MSG = { title: '⚠️ 入場失敗', body: '無法驗證入場資格，請聯絡前台查詢。' };

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(DeviceToken)   private readonly tokenRepo: Repository<DeviceToken>,
    @InjectRepository(Notification)  private readonly notiRepo: Repository<Notification>,
    @InjectRepository(User)          private readonly userRepo: Repository<User>,
    private readonly pgm: PgmClient,
  ) {}

  // ── Device token ──────────────────────────────────────────────────────────

  async registerToken(userId: string, token: string, platform: string, brand: string): Promise<void> {
    await this.tokenRepo.upsert(
      { userId, token, platform: platform as 'ios' | 'android' | 'web', brand },
      { conflictPaths: ['userId', 'token'] },
    );
  }

  // ── Inbox ─────────────────────────────────────────────────────────────────

  async list(userId: string, tab: 'personal' | 'announcements' = 'personal') {
    const types: NotificationType[] = tab === 'announcements'
      ? ['announcement']
      : ['booking_confirmed', 'booking_cancelled', 'waitlist_upgraded',
         'pt_verified', 'entry_denied', 'membership_expiring'];

    const items = await this.notiRepo
      .createQueryBuilder('n')
      .where('n.user_id = :userId', { userId })
      .andWhere('n.type IN (:...types)', { types })
      .orderBy('n.created_at', 'DESC')
      .limit(50)
      .getMany();

    const unread = items.filter(n => !n.readAt).length;
    return { items, unread };
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.notiRepo.update(
      { id: notificationId, userId },
      { readAt: new Date() },
    );
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notiRepo
      .createQueryBuilder()
      .update()
      .set({ readAt: new Date() })
      .where('user_id = :userId AND read_at IS NULL', { userId })
      .execute();
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notiRepo.count({ where: { userId, readAt: IsNull() } });
  }

  // ── Create + push ─────────────────────────────────────────────────────────

  async create(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    push?: boolean;
  }): Promise<void> {
    await this.notiRepo.save(this.notiRepo.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ?? null,
    }));

    if (input.push !== false) {
      const tokens = await this.tokenRepo.find({ where: { userId: input.userId } });
      if (tokens.length > 0) {
        await this.sendPush(
          tokens.map(t => t.token),
          input.title,
          input.body,
          input.data ?? {},
        );
      }
    }
  }

  // ── n8n webhook: checkin failed ───────────────────────────────────────────

  async handleCheckinFailed(input: {
    memberNumber: string;
    reason: string;
    club: string;
    timestamp: string;
  }): Promise<void> {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .where('u.pgm_member_id::text = :num', { num: input.memberNumber })
      .getOne();

    if (!user) {
      this.logger.warn(`checkin-failed: no user for member ${input.memberNumber}`);
      return;
    }

    const msg = REASON_MESSAGES[input.reason] ?? DEFAULT_ENTRY_MSG;
    await this.create({
      userId: user.id,
      type: 'entry_denied',
      title: msg.title,
      body: msg.body,
      data: { reason: input.reason, club: input.club },
    });
  }

  // ── Event helpers (called by BookingsService, PtService etc.) ─────────────

  async notifyBookingConfirmed(userId: string, bookingId: string, classId: number): Promise<void> {
    await this.create({
      userId,
      type: 'booking_confirmed',
      title: '✅ 預約確認',
      body: `Class #${classId} 預約成功！`,
      data: { bookingId, classId: String(classId) },
    });
  }

  async notifyBookingCancelled(userId: string, bookingId: string): Promise<void> {
    await this.create({
      userId, type: 'booking_cancelled',
      title: '❌ 預約取消', body: '你嘅預約已成功取消。',
      data: { bookingId },
    });
  }

  async notifyWaitlistUpgraded(userId: string, bookingId: string, classId: number): Promise<void> {
    await this.create({
      userId, type: 'waitlist_upgraded',
      title: '🎉 候補成功！', body: `Class #${classId} 有位空出，你已自動確認！`,
      data: { bookingId, classId: String(classId) },
    });
  }

  async notifyPtVerified(userId: string, sessionId: string): Promise<void> {
    await this.create({
      userId, type: 'pt_verified',
      title: '💪 PT 堂確認', body: '今日 PT session 已成功簽名確認。',
      data: { sessionId }, push: false,
    });
  }

  // Broadcast to all members was a BROADCAST_SECRET route; it moves to the staff admin
  // page (staff accounts + 2FA + audit log, backend-plan / mvp-plan E section).

  // ── Direct push (no inbox record — for transient alerts) ─────────────────

  async sendDirectPush(userId: string, title: string, body: string, data: Record<string, unknown> = {}): Promise<void> {
    const tokens = await this.tokenRepo.find({ where: { userId } });
    if (tokens.length === 0) return;
    await this.sendPush(tokens.map(t => t.token), title, body, data);
  }

  // ── Monthly summary cron ─────────────────────────────────────────────────

  @Cron('0 9 1 * *', { timeZone: 'Asia/Hong_Kong' }) // 9 AM HKT, 1st of month
  async sendMonthlySummary(): Promise<void> {
    if (!backgroundJobsEnabled()) return;
    this.logger.log('Sending monthly summary notifications…');
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const monthName = lastMonth.toLocaleDateString('en-HK', { month: 'long', year: 'numeric' });

    const users = await this.userRepo.find({ where: { status: 'active' } });
    for (const user of users) {
      if (user.pgmMemberId === null) continue;
      try {
        const visits = await this.fetchLastMonthVisits(user.pgmMemberId, lastMonth);
        if (visits === 0) continue;
        await this.sendDirectPush(
          user.id,
          `Your ${monthName} Summary 💪`,
          `You visited GO24 ${visits} time${visits !== 1 ? 's' : ''} last month. Keep it up!`,
          { type: 'monthly_summary', month: monthName, visits },
        );
      } catch { /* skip */ }
    }
  }

  private async fetchLastMonthVisits(pgmMemberId: number, month: Date): Promise<number> {
    try {
      const start = new Date(month.getFullYear(), month.getMonth(), 1);
      const end   = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      const res = await this.pgm.get<{ value: any[] }>('/odata/MemberClubVisits', {
        $filter: `memberId eq ${pgmMemberId} and enterDate ge ${start.toISOString().slice(0,19)}Z and enterDate le ${end.toISOString().slice(0,19)}Z`,
        $select: 'id',
        $top: 200,
      });
      return res.value?.length ?? 0;
    } catch { return 0; }
  }

  // ── Internal push ─────────────────────────────────────────────────────────

  /**
   * Sends via Expo in batches of 100 (Expo's per-request limit). Tokens Expo reports
   * as DeviceNotRegistered (app uninstalled) are deleted so we stop sending to them.
   * Delivery receipts (errors reported later by Apple/Google) are not polled yet.
   */
  private async sendPush(tokens: string[], title: string, body: string, data: Record<string, unknown>): Promise<void> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const accessToken = process.env.EXPO_ACCESS_TOKEN;
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    for (let i = 0; i < tokens.length; i += EXPO_BATCH) {
      const batch = tokens.slice(i, i + EXPO_BATCH);
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify(batch.map(to => ({ to, title, body, data, sound: 'default' }))),
        });
        const json = (await res.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
        const dead = deadTokens(batch, json?.data);
        if (dead.length) {
          await this.tokenRepo.delete({ token: In(dead) });
          this.logger.log(`Removed ${dead.length} unregistered push token(s)`);
        }
      } catch (err) {
        this.logger.error('Push failed', err);
      }
    }
  }
}
