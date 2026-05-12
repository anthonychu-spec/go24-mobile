import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pool } from 'pg';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from '../auth/entities/user.entity';
import { PgmClient } from '../pgm-adapter/pgm.client';
import { PgmBookingAdapter } from '../booking/pgm-booking.adapter';
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

/** gym_data stores timestamps WITHOUT timezone — they are HKT (UTC+8). Append offset so JS treats them correctly. */
function toHktIso(d: Date | string): string {
  const raw = typeof d === 'string' ? d : d.toISOString();
  // If already has timezone info, return as-is
  if (raw.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(raw)) {
    // Raw is UTC but actual value is HKT — subtract 8h
    const utc = new Date(raw);
    utc.setHours(utc.getHours() - 8);
    return utc.toISOString();
  }
  return new Date(raw + '+08:00').toISOString();
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly pgm: PgmClient,
    private readonly pgmBooking: PgmBookingAdapter,
    @Inject(GYM_DATA_POOL) private readonly gymPool: Pool | null,
  ) {}

  async getActivity(pgmMemberId: number, userId: string): Promise<{
    summary: ActivitySummary;
    items: ActivityItem[];
    errors: string[];
  }> {
    const since = new Date();
    since.setMonth(since.getMonth() - 12);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Resolve user_number (memberCode) for gym_data queries
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const gymUserNumber = user?.memberCode ?? pgmMemberId.toString();

    const [classes, checkins, ptSessions] = await Promise.allSettled([
      this.fetchClasses(gymUserNumber, userId, since, today),
      this.fetchCheckins(gymUserNumber, pgmMemberId, since, today),
      this.fetchPt(gymUserNumber, since),
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

  private async fetchClasses(gymUserNumber: string, userId: string, since: Date, today: Date): Promise<ActivityItem[]> {
    const [dbResult, upcomingBookings] = await Promise.allSettled([
      // Historical attended classes (before today) → studio.by_member DB
      this.gymPool?.query(
        `SELECT class_date, class_name, club, has_presence FROM studio.by_member
         WHERE user_number = $1
         AND class_date >= $2 AND class_date < $3
         ORDER BY class_date DESC LIMIT 300`,
        [gymUserNumber, since, today],
      ),
      // Upcoming + recent bookings → local bookings table (full 2-month window)
      this.bookingRepo
        .createQueryBuilder('b')
        .where('b.user_id = :userId', { userId })
        .andWhere('b.status IN (:...statuses)', { statuses: ['confirmed', 'pending', 'waitlist', 'attended', 'pending_verify'] })
        .andWhere('b.created_at >= :since', { since })
        .orderBy('b.created_at', 'DESC')
        .limit(200)
        .getMany(),
    ]);

    const historicalItems: ActivityItem[] = dbResult.status === 'fulfilled' && dbResult.value
      ? dbResult.value.rows.map((r: any) => ({
          id: `class-db-${toHktIso(r.class_date)}-${r.class_name}`,
          type: 'class' as ActivityType,
          title: r.class_name ?? 'Class',
          subtitle: r.has_presence ? 'Attended' : 'Booked',
          at: toHktIso(r.class_date),
          club: r.club ?? null,
        }))
      : (this.logger.warn('gym_data studio query failed', (dbResult as PromiseRejectedResult).reason), []);

    // Use local booking data (class_name, club_name, start_time saved at booking time)
    const bookings = upcomingBookings.status === 'fulfilled' ? upcomingBookings.value : [];

    // Skip old bookings without class_name when gym_data covers them
    const relevantBookings = this.gymPool
      ? bookings.filter(b => b.className != null)
      : bookings;

    const bookingItems: ActivityItem[] = relevantBookings.map(b => ({
      id: `class-${b.id}`,
      type: 'class' as ActivityType,
      title: b.className ?? `Class #${b.classId}`,
      subtitle: b.status === 'attended' ? 'Attended'
              : b.status === 'waitlist' ? 'Waitlisted'
              : b.status === 'pending_verify' ? 'Verifying'
              : 'Upcoming',
      at: b.startTime?.toISOString() ?? b.createdAt.toISOString(),
      club: b.clubName ?? null,
    }));

    // When DB available: merge DB attended + bookings (dedup by date)
    const dbDates = new Set(historicalItems.map(i => i.at.slice(0, 10)));
    const filteredBookings = this.gymPool
      ? bookingItems.filter(i => !dbDates.has(i.at.slice(0, 10)))
      : bookingItems;

    return [...filteredBookings, ...historicalItems];
  }

  private async fetchCheckins(gymUserNumber: string, pgmMemberId: number, since: Date, today: Date): Promise<ActivityItem[]> {
    // Historical (before today) → local gym_data DB
    const [dbResult, todayResult] = await Promise.allSettled([
      this.gymPool?.query(
        `SELECT id, enter_date, club FROM pgm.visits
         WHERE user_number = $1 AND enter_date >= $2 AND enter_date < $3
         ORDER BY enter_date DESC LIMIT 300`,
        [gymUserNumber, since, today],
      ),
      // Today → PGM API (live) — uses pgmMemberId (PGM API id)
      this.pgm.get<{ value: any[] }>('/odata/Visits', {
        $filter: `memberId eq ${pgmMemberId} and enterDate ge datetime'${today.toISOString().slice(0, 19)}'`,
        $select: 'id,enterDate',
        $top: 50,
      }).catch((err: any) => {
        if (err?.response?.status === 404 || err?.status === 404) return { value: [] };
        throw err;
      }),
    ]);

    const dbItems: ActivityItem[] = dbResult.status === 'fulfilled' && dbResult.value
      ? dbResult.value.rows.map((v: any) => ({
          id: `checkin-db-${v.id}`,
          type: 'checkin' as ActivityType,
          title: 'Check-in',
          subtitle: null,
          at: toHktIso(v.enter_date),
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

  private async fetchPt(gymUserNumber: string, since: Date): Promise<ActivityItem[]> {
    if (!this.gymPool) return [];
    try {
      const result = await this.gymPool.query(
        `SELECT done_date, product_name, club FROM commissions.done
         WHERE SPLIT_PART(user_number, '.', 1) = $1
         AND commission_category = 'PT'
         AND done_date >= $2
         ORDER BY done_date DESC LIMIT 200`,
        [gymUserNumber, since],
      );
      return result.rows.map((r: any) => ({
        id: `pt-${toHktIso(r.done_date)}-${r.product_name}`,
        type: 'pt' as ActivityType,
        title: r.product_name ?? 'PT Session',
        subtitle: r.club ?? null,
        at: toHktIso(r.done_date),
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
