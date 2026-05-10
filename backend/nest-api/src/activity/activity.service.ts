import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pool } from 'pg';
import { Booking } from '../bookings/entities/booking.entity';
import { PgmClient } from '../pgm-adapter/pgm.client';
import { GYM_DATA_POOL } from './activity.constants';

export type ActivityType = 'class' | 'pt' | 'checkin';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  subtitle: string | null;
  at: string;           // ISO 8601
  club: string | null;
}

export interface ActivitySummary {
  classesTotal: number;
  ptTotal: number;
  checkinsTotal: number;
  streakDays: number;
  thisMonth: { classes: number; pt: number; checkins: number };
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    private readonly pgm: PgmClient,
    @Inject(GYM_DATA_POOL) private readonly gymPool: Pool,
  ) {}

  async getActivity(pgmMemberId: number, userId: string): Promise<{
    summary: ActivitySummary;
    items: ActivityItem[];
    errors: string[];
  }> {
    const since = new Date();
    since.setMonth(since.getMonth() - 2);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [classes, checkins, ptSessions] = await Promise.allSettled([
      this.fetchClasses(pgmMemberId, userId, since, today),
      this.fetchCheckins(pgmMemberId, since, today),
      this.fetchPt(pgmMemberId, since),
    ]);

    const errors: string[] = [];
    const classItems = classes.status === 'fulfilled' ? classes.value : (errors.push('classes'), []);
    const checkinItems = checkins.status === 'fulfilled' ? checkins.value : (errors.push('checkins'), []);
    const ptItems = ptSessions.status === 'fulfilled' ? ptSessions.value : (errors.push('pt'), []);

    if (classes.status === 'rejected') this.logger.error('fetchClasses failed', classes.reason);
    if (checkins.status === 'rejected') this.logger.error('fetchCheckins failed', checkins.reason);
    if (ptSessions.status === 'rejected') this.logger.error('fetchPt failed', ptSessions.reason);

    const allItems = [...classItems, ...checkinItems, ...ptItems]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const summary = this.buildSummary(classItems, checkinItems, ptItems);

    return { summary, items: allItems, errors };
  }

  private async fetchClasses(pgmMemberId: number, userId: string, since: Date, today: Date): Promise<ActivityItem[]> {
    const [dbResult, upcomingBookings] = await Promise.allSettled([
      // Historical attended classes (before today) → studio.by_member DB
      this.gymPool.query(
        `SELECT class_date, class_name, club FROM studio.by_member
         WHERE user_number = $1
         AND class_date >= $2 AND class_date < $3
         AND has_presence = true
         ORDER BY class_date DESC LIMIT 300`,
        [pgmMemberId.toString(), since, today],
      ),
      // Today + upcoming → local bookings table
      this.bookingRepo
        .createQueryBuilder('b')
        .where('b.user_id = :userId', { userId })
        .andWhere('b.status IN (:...statuses)', { statuses: ['confirmed', 'pending', 'waitlist', 'pending_verify'] })
        .andWhere('b.created_at >= :today', { today })
        .orderBy('b.created_at', 'DESC')
        .limit(50)
        .getMany(),
    ]);

    const historicalItems: ActivityItem[] = dbResult.status === 'fulfilled'
      ? dbResult.value.rows.map((r: any) => ({
          id: `class-db-${new Date(r.class_date).toISOString()}-${r.class_name}`,
          type: 'class' as ActivityType,
          title: r.class_name ?? 'Class',
          subtitle: 'Attended',
          at: new Date(r.class_date).toISOString(),
          club: r.club ?? null,
        }))
      : (this.logger.warn('gym_data studio query failed', (dbResult as PromiseRejectedResult).reason), []);

    const upcomingItems: ActivityItem[] = upcomingBookings.status === 'fulfilled'
      ? upcomingBookings.value.map(b => ({
          id: `class-${b.id}`,
          type: 'class' as ActivityType,
          title: `Class #${b.classId}`,
          subtitle: b.status === 'waitlist' ? 'Waitlisted' : b.status === 'pending_verify' ? 'Verifying' : 'Upcoming',
          at: b.createdAt.toISOString(),
          club: null,
        }))
      : [];

    return [...upcomingItems, ...historicalItems];
  }

  private async fetchCheckins(pgmMemberId: number, since: Date, today: Date): Promise<ActivityItem[]> {
    // Historical (before today) → local gym_data DB
    const [dbResult, todayResult] = await Promise.allSettled([
      this.gymPool.query(
        `SELECT id, enter_date, club FROM pgm.visits
         WHERE user_number = $1 AND enter_date >= $2 AND enter_date < $3
         ORDER BY enter_date DESC LIMIT 300`,
        [pgmMemberId.toString(), since, today],
      ),
      // Today → PGM API (live)
      this.pgm.get<{ value: any[] }>('/odata/Visits', {
        $filter: `memberId eq ${pgmMemberId} and enterDate ge datetime'${today.toISOString().slice(0, 19)}'`,
        $select: 'id,enterDate',
        $top: 50,
      }).catch((err: any) => {
        if (err?.response?.status === 404 || err?.status === 404) return { value: [] };
        throw err;
      }),
    ]);

    const dbItems: ActivityItem[] = dbResult.status === 'fulfilled'
      ? dbResult.value.rows.map((v: any) => ({
          id: `checkin-db-${v.id}`,
          type: 'checkin' as ActivityType,
          title: 'Check-in',
          subtitle: null,
          at: new Date(v.enter_date).toISOString(),
          club: v.club ?? null,
        }))
      : (this.logger.warn('gym_data visits query failed', (dbResult as PromiseRejectedResult).reason), []);

    const todayItems: ActivityItem[] = todayResult.status === 'fulfilled'
      ? ((todayResult.value as { value: any[] }).value ?? []).map((v: any) => ({
          id: `checkin-${v.id}`,
          type: 'checkin' as ActivityType,
          title: 'Check-in',
          subtitle: null,
          at: v.enterDate,
          club: null,
        }))
      : (this.logger.warn('PGM today visits failed', (todayResult as PromiseRejectedResult).reason), []);

    return [...todayItems, ...dbItems];
  }

  private async fetchPt(pgmMemberId: number, since: Date): Promise<ActivityItem[]> {
    try {
      const result = await this.gymPool.query(
        `SELECT done_date, product_name, club FROM commissions.done
         WHERE CAST(SPLIT_PART(user_number, '.', 1) AS BIGINT) = $1
         AND commission_category = 'PT'
         AND done_date >= $2
         ORDER BY done_date DESC LIMIT 200`,
        [pgmMemberId, since],
      );
      return result.rows.map((r: any) => ({
        id: `pt-${new Date(r.done_date).toISOString()}-${r.product_name}`,
        type: 'pt' as ActivityType,
        title: r.product_name ?? 'PT Session',
        subtitle: r.club ?? null,
        at: new Date(r.done_date).toISOString(),
        club: r.club ?? null,
      }));
    } catch (err) {
      this.logger.warn('gym_data PT query failed', err);
      return [];
    }
  }

  private buildSummary(
    classes: ActivityItem[],
    checkins: ActivityItem[],
    pt: ActivityItem[],
  ): ActivitySummary {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonthClasses = classes.filter(i => new Date(i.at) >= monthStart).length;
    const thisMonthCheckins = checkins.filter(i => new Date(i.at) >= monthStart).length;
    const thisMonthPt = pt.filter(i => new Date(i.at) >= monthStart).length;

    // Streak: consecutive days with any activity
    const allDays = new Set(
      [...classes, ...checkins, ...pt].map(i => i.at.slice(0, 10)),
    );
    const streakDays = this.calcStreak(allDays);

    return {
      classesTotal: classes.length,
      ptTotal: pt.length,
      checkinsTotal: checkins.length,
      streakDays,
      thisMonth: { classes: thisMonthClasses, pt: thisMonthPt, checkins: thisMonthCheckins },
    };
  }

  private calcStreak(days: Set<string>): number {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (!days.has(d.toISOString().slice(0, 10))) break;
      streak++;
    }
    return streak;
  }
}
