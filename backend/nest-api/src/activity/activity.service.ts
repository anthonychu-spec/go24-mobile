import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { PgmClient } from '../pgm-adapter/pgm.client';
import { PgmBookingAdapter } from '../booking/pgm-booking.adapter';
import type { PgmBooking } from '../booking/booking.interfaces';

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
    private readonly pgmBooking: PgmBookingAdapter,
  ) {}

  async getActivity(pgmMemberId: number, userId: string): Promise<{
    summary: ActivitySummary;
    items: ActivityItem[];
    errors: string[];
  }> {
    const since = new Date();
    since.setMonth(since.getMonth() - 3);

    const [classes, checkins, ptSessions] = await Promise.allSettled([
      this.fetchClasses(pgmMemberId, userId, since),
      this.fetchCheckins(pgmMemberId, since),
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

  private async fetchClasses(pgmMemberId: number, userId: string, since: Date): Promise<ActivityItem[]> {
    // Use historical bookings method which fetches classes in the same date window
    const [pgmBookings, localBookings] = await Promise.all([
      this.pgmBooking.listHistoricalBookings(pgmMemberId, since),
      this.bookingRepo
        .createQueryBuilder('b')
        .where('b.user_id = :userId', { userId })
        .andWhere('b.status IN (:...statuses)', { statuses: ['confirmed', 'pending', 'waitlist', 'attended', 'pending_verify'] })
        .andWhere('b.created_at >= :since', { since })
        .orderBy('b.created_at', 'DESC')
        .limit(200)
        .getMany(),
    ]);

    // Build PGM booking lookup by classId for name/club enrichment
    const pgmMap = new Map<number, PgmBooking>(pgmBookings.map(b => [b.classId, b]));

    return localBookings.map(b => {
      const pgm = pgmMap.get(b.classId);
      const statusLabel = b.status === 'attended'       ? 'Attended'
                        : b.status === 'waitlist'        ? 'Waitlisted'
                        : b.status === 'pending_verify'  ? 'Verifying'
                        : 'Upcoming';
      return {
        id: `class-${b.id}`,
        type: 'class' as ActivityType,
        title: pgm?.className ?? `Class #${b.classId}`,
        subtitle: statusLabel,
        at: pgm?.startTime ?? b.createdAt.toISOString(),
        club: pgm?.clubName ?? null,
      };
    });
  }

  private async fetchCheckins(pgmMemberId: number, since: Date): Promise<ActivityItem[]> {
    const res = await this.pgm.get<{ value: any[] }>('/odata/Visits', {
      $filter: `memberId eq ${pgmMemberId} and enterDate ge datetime'${since.toISOString().slice(0, 19)}'`,
      $select: 'id,enterDate,clubId',
      $top: 200,
    });

    return (res.value ?? [])
      .sort((a: any, b: any) => new Date(b.enterDate).getTime() - new Date(a.enterDate).getTime())
      .map((v: any) => ({
        id: `checkin-${v.id}`,
        type: 'checkin' as ActivityType,
        title: 'Check-in',
        subtitle: null,
        at: v.enterDate,
        club: v.clubId ? String(v.clubId) : null,
      }));
  }

  private async fetchPt(pgmMemberId: number, since: Date): Promise<ActivityItem[]> {
    const res = await this.pgm.get<{ value: any[] }>('/odata/PtAgreementUsages', {
      $filter: `memberId eq ${pgmMemberId}`,
      $select: 'id,memberId,trainerId,agreementId,date,status',
      $orderby: 'date desc',
      $top: 200,
    });

    const sinceMs = since.getTime();
    return (res.value ?? [])
      .filter((p: any) => p.date && new Date(p.date).getTime() >= sinceMs)
      .map((p: any) => ({
        id: `pt-${p.id}`,
        type: 'pt' as ActivityType,
        title: 'PT Session',
        subtitle: p.trainerId ? `Trainer #${p.trainerId}` : null,
        at: p.date,
        club: null,
      }));
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
