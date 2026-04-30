import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { PgmClient } from '../pgm-adapter/pgm.client';
import { Booking } from '../bookings/entities/booking.entity';

export interface DashboardData {
  user: { name: string | null; email: string | null };
  membership: {
    active: boolean;
    planName: string | null;
    daysRemaining: number | null;
    expiresAt: string | null;
  };
  pt: {
    remainingSessions: number;
    totalSessions: number;
    expiresAt: string | null;
  };
  nextClass: {
    bookingId: string;
    classId: number;
    startTime: string;
    minutesUntil: number;
    clubName: string | null;
  } | null;
  thisMonth: {
    visits: number;
    classes: number;
    pt: number;
  };
  unreadNotifications: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    private readonly pgm: PgmClient,
  ) {}

  async getDashboard(userId: string, pgmMemberId: number, email: string | null): Promise<DashboardData> {
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const [contracts, ptAgreements, visits, nextBooking, monthClasses] = await Promise.allSettled([
      this.fetchActiveContract(pgmMemberId),
      this.fetchPtAgreements(pgmMemberId),
      this.fetchMonthVisits(pgmMemberId, monthStart),
      this.fetchNextBooking(userId),
      this.bookingRepo.count({
        where: { userId, status: 'confirmed', createdAt: MoreThan(monthStart) },
      }),
    ]);

    const contract     = contracts.status     === 'fulfilled' ? contracts.value     : null;
    const agreements   = ptAgreements.status  === 'fulfilled' ? ptAgreements.value  : [];
    const visitCount   = visits.status        === 'fulfilled' ? visits.value        : 0;
    const next         = nextBooking.status   === 'fulfilled' ? nextBooking.value   : null;
    const classes      = monthClasses.status  === 'fulfilled' ? monthClasses.value  : 0;

    const totalRemaining = agreements.reduce((s, a) => s + (a.remainingSessions ?? 0), 0);
    const totalSessions  = agreements.reduce((s, a) => s + (a.totalSessions ?? 0), 0);
    const ptExpires      = agreements.length > 0
      ? agreements.map(a => a.endDate).sort().reverse()[0]
      : null;

    let daysRemaining: number | null = null;
    if (contract?.endDate) {
      daysRemaining = Math.ceil((new Date(contract.endDate).getTime() - Date.now()) / 86400000);
    }

    return {
      user: { name: email?.split('@')[0] ?? null, email },
      membership: {
        active: contract != null,
        planName: contract?.planName ?? null,
        daysRemaining,
        expiresAt: contract?.endDate ?? null,
      },
      pt: {
        remainingSessions: totalRemaining,
        totalSessions,
        expiresAt: ptExpires,
      },
      nextClass: next,
      thisMonth: { visits: visitCount, classes, pt: 0 },
      unreadNotifications: 0,
    };
  }

  private async fetchActiveContract(pgmMemberId: number): Promise<{ planName: string | null; endDate: string } | null> {
    try {
      const res = await this.pgm.get<{ value: any[] }>('/odata/Contracts', {
        $filter: `memberId eq ${pgmMemberId} and status eq 'Current' and isDeleted eq false`,
        $orderby: 'endDate desc',
        $top: 1,
      });
      const c = res.value?.[0];
      if (!c) return null;
      return { planName: c.planName ?? null, endDate: c.endDate };
    } catch { return null; }
  }

  private async fetchPtAgreements(pgmMemberId: number): Promise<any[]> {
    try {
      const res = await this.pgm.get<{ value: any[] }>('/odata/PtAgreements', {
        $filter: `memberId eq ${pgmMemberId} and isDeleted eq false`,
        $select: 'totalSessions,remainingSessions,endDate',
        $top: 10,
      });
      return res.value ?? [];
    } catch { return []; }
  }

  private async fetchMonthVisits(pgmMemberId: number, since: Date): Promise<number> {
    try {
      const res = await this.pgm.get<{ value: any[] }>('/odata/Visits', {
        $filter: `memberId eq ${pgmMemberId} and enterDate ge datetime'${since.toISOString().slice(0, 19)}'`,
        $select: 'id',
        $top: 200,
      });
      return res.value?.length ?? 0;
    } catch { return 0; }
  }

  private async fetchNextBooking(userId: string): Promise<DashboardData['nextClass']> {
    const next = await this.bookingRepo
      .createQueryBuilder('b')
      .where('b.user_id = :userId', { userId })
      .andWhere('b.status = :status', { status: 'confirmed' })
      .orderBy('b.created_at', 'DESC')
      .limit(1)
      .getOne();

    if (!next) return null;

    return {
      bookingId: next.id,
      classId: next.classId,
      startTime: next.createdAt.toISOString(),
      minutesUntil: Math.max(0, Math.floor((next.createdAt.getTime() - Date.now()) / 60000)),
      clubName: null,
    };
  }
}
