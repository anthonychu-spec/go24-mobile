import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { PgmClient } from '../pgm-adapter/pgm.client';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from '../auth/entities/user.entity';
import { BOOKING_REPO } from '../booking/booking.interfaces';
import type { IBookingRepo } from '../booking/booking.interfaces';
import { PaymentsService } from '../payments/payments.service';

export interface DashboardData {
  user: { name: string | null; email: string | null; memberCode: string | null };
  savedCardExpired: boolean;
  membership: {
    active: boolean;
    planName: string | null;
    daysRemaining: number | null;
    expiresAt: string | null;
    outstandingBalance: number;
  };
  pt: {
    remainingSessions: number;
    totalSessions: number;
    expiresAt: string | null;
  };
  nextClass: {
    bookingId: string;
    classId: number;
    className: string | null;
    startTime: string;
    minutesUntil: number;
    clubName: string | null;
  } | null;
  thisMonth: {
    visits: number;
    classes: number;
    pt: number;
  };
  totalVisits: number;
  unreadNotifications: number;
  streak: number;
}

export interface MemberProfileData {
  member: {
    pgmId: number;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    memberCode: string | null;
  };
  hasMembership: boolean;
  balance: {
    outstanding: number;
    currency: string;
    invoices: Array<{
      id: number;
      description: string | null;
      amount: number;
      dueDate: string | null;
      status: string;
    }>;
  };
  savedCard: {
    brand: string | null;
    summary: string | null;
    expiryMonth: string | null;
    expiryYear: string | null;
  } | null;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(User)    private readonly userRepo: Repository<User>,
    private readonly pgm: PgmClient,
    private readonly paymentsService: PaymentsService,
    @Inject(BOOKING_REPO) private readonly bookingAdapter: IBookingRepo,
  ) {}

  async getDashboard(userId: string, pgmMemberId: number, _email: string | null): Promise<DashboardData> {
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const [contracts, ptAgreements, visits, nextBooking, monthClasses, memberMeta, streakResult, totalVisitsResult, userRecord, cardResult] = await Promise.allSettled([
      this.fetchActiveContract(pgmMemberId),
      this.fetchPtAgreements(pgmMemberId),
      this.fetchMonthVisits(pgmMemberId, monthStart),
      this.fetchNextBooking(userId),
      this.bookingRepo.count({
        where: { userId, status: 'confirmed', createdAt: MoreThan(monthStart) },
      }),
      this.fetchMemberMeta(pgmMemberId),
      this.fetchStreak(pgmMemberId, userId),
      this.fetchTotalVisits(pgmMemberId),
      this.userRepo.findOne({ where: { id: userId }, select: ['memberCode'] }),
      this.paymentsService.getCard(userId),
    ]);

    const contract    = contracts.status         === 'fulfilled' ? contracts.value         : null;
    const agreements  = ptAgreements.status      === 'fulfilled' ? ptAgreements.value      : [];
    const visitCount  = visits.status            === 'fulfilled' ? visits.value            : 0;
    const next        = nextBooking.status       === 'fulfilled' ? nextBooking.value        : null;
    const classes     = monthClasses.status      === 'fulfilled' ? monthClasses.value      : 0;
    const meta        = memberMeta.status        === 'fulfilled' ? memberMeta.value        : { name: null, outstanding: 0 };
    const streak      = streakResult.status      === 'fulfilled' ? streakResult.value      : 0;
    const totalVisits = totalVisitsResult.status === 'fulfilled' ? totalVisitsResult.value : 0;
    const memberCode  = userRecord.status === 'fulfilled' ? (userRecord.value?.memberCode ?? null) : null;
    const savedCard   = cardResult.status === 'fulfilled' ? cardResult.value : null;
    const savedCardExpired = savedCard != null ? this.isCardExpired(savedCard.expiryMonth, savedCard.expiryYear) : false;

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
      user: { name: meta.name, email: null, memberCode },
      savedCardExpired,
      membership: {
        active: contract != null,
        planName: contract?.planName ?? null,
        daysRemaining,
        expiresAt: contract?.endDate ?? null,
        outstandingBalance: meta.outstanding,
      },
      pt: { remainingSessions: totalRemaining, totalSessions, expiresAt: ptExpires },
      nextClass: next,
      thisMonth: { visits: visitCount, classes, pt: 0 },
      totalVisits,
      unreadNotifications: 0,
      streak,
    };
  }

  async getMemberships(pgmMemberId: number) {
    const [contractsRes, plansRes, clubsRes] = await Promise.allSettled([
      this.pgm.get<{ value: any[] }>('/odata/Contracts', {
        $filter: `memberId eq ${pgmMemberId} and isDeleted eq false`,
        $orderby: 'startDate desc',
        $select: 'id,status,isActive,startDate,endDate,signUpDate,cancelDate,paymentPlanId,clubId,automaticRenew',
      }),
      this.pgm.get<{ value: any[] }>('/odata/PaymentPlans', { $select: 'id,name' }),
      this.pgm.get<{ value: any[] }>('/odata/Clubs', { $select: 'id,name' }),
    ]);

    const contracts = contractsRes.status === 'fulfilled' ? (contractsRes.value.value ?? []) : [];

    const planMap = new Map<number, string>();
    if (plansRes.status === 'fulfilled') {
      for (const p of (plansRes.value.value ?? [])) planMap.set(p.id, p.name);
    }
    const clubMap = new Map<number, string>();
    if (clubsRes.status === 'fulfilled') {
      for (const c of (clubsRes.value.value ?? [])) clubMap.set(c.id, c.name);
    }

    return contracts.map(c => ({
      id:            c.id,
      planName:      planMap.get(c.paymentPlanId) ?? null,
      clubName:      clubMap.get(c.clubId) ?? null,
      status:        c.status as string,
      isActive:      c.isActive as boolean,
      startDate:     c.startDate as string,
      endDate:       c.endDate as string | null,
      signUpDate:    c.signUpDate as string,
      cancelDate:    c.cancelDate as string | null,
      automaticRenew: c.automaticRenew as boolean,
    }));
  }

  async getProfile(userId: string, pgmId: number): Promise<MemberProfileData> {
    const [memberRes, invoicesRes, userRes, cardRes, contractRes] = await Promise.allSettled([
      this.pgm.get<{ value: any[] }>('/odata/Members', {
        $filter: `id eq ${pgmId}`,
        $select: 'id,firstName,lastName,email,phone',
        $top: 1,
      }),
      this.pgm.get<{ value: any[] }>('/odata/Invoices', {
        $filter: `memberId eq ${pgmId} and isPaid eq false`,
        $select: 'id,totalAmount,dueDate,description,status',
        $top: 20,
        $orderby: 'dueDate desc',
      }),
      this.userRepo.findOne({ where: { id: userId } }),
      this.paymentsService.getCard(userId),
      this.fetchActiveContract(pgmId),
    ]);

    const pgmMember    = memberRes.status    === 'fulfilled' ? memberRes.value.value?.[0] : null;
    const invoices     = invoicesRes.status  === 'fulfilled' ? (invoicesRes.value.value ?? []) : [];
    const user         = userRes.status      === 'fulfilled' ? userRes.value : null;
    const card         = cardRes.status      === 'fulfilled' ? cardRes.value : null;
    const hasMembership = contractRes.status === 'fulfilled' ? contractRes.value !== null : false;

    const outstanding = invoices.reduce((s: number, inv: any) => s + (inv.totalAmount ?? 0), 0);
    const name = pgmMember
      ? `${pgmMember.firstName ?? ''} ${pgmMember.lastName ?? ''}`.trim() || null
      : null;

    return {
      hasMembership,
      member: {
        pgmId,
        name,
        firstName:  pgmMember?.firstName  ?? null,
        lastName:   pgmMember?.lastName   ?? null,
        email:      pgmMember?.email      ?? user?.email      ?? null,
        phone:      pgmMember?.phone      ?? user?.phone      ?? null,
        memberCode: user?.memberCode ?? null,
      },
      balance: {
        outstanding,
        currency: 'HKD',
        invoices: invoices.map((inv: any) => ({
          id:          inv.id,
          description: inv.description ?? null,
          amount:      inv.totalAmount  ?? 0,
          dueDate:     inv.dueDate      ?? null,
          status:      inv.status       ?? 'Unpaid',
        })),
      },
      savedCard: card ? {
        brand:       card.cardBrand,
        summary:     card.cardSummary,
        expiryMonth: card.expiryMonth,
        expiryYear:  card.expiryYear,
      } : null,
    };
  }

  async payOutstanding(userId: string, pgmId: number): Promise<{
    success: boolean;
    pspReference?: string;
    resultCode: string;
    amountCharged: number;
  }> {
    // Always fetch live amount from PGM — never trust client-side amount
    const invoicesRes = await this.pgm.get<{ value: any[] }>('/odata/Invoices', {
      $filter: `memberId eq ${pgmId} and isPaid eq false`,
      $select: 'id,totalAmount',
      $top: 20,
    });
    const invoices = invoicesRes.value ?? [];
    const totalHkd = invoices.reduce((s: number, i: any) => s + (i.totalAmount ?? 0), 0);

    if (totalHkd <= 0) {
      return { success: true, resultCode: 'NoBalance', amountCharged: 0 };
    }

    const ref = `outstanding-${pgmId}-${Date.now()}`;
    const result = await this.paymentsService.chargeOutstanding(userId, totalHkd, ref);
    return { ...result, amountCharged: totalHkd };
  }

  // ── Private helpers ──────────────────────────────────────────

  /** Fetch member name + outstanding balance from PGM in parallel */
  private async fetchMemberMeta(pgmMemberId: number): Promise<{ name: string | null; outstanding: number }> {
    try {
      const [memberRes, invoicesRes] = await Promise.allSettled([
        this.pgm.get<{ value: any[] }>('/odata/Members', {
          $filter: `id eq ${pgmMemberId}`,
          $select: 'id,firstName,lastName',
          $top: 1,
        }),
        this.pgm.get<{ value: any[] }>('/odata/Invoices', {
          $filter: `memberId eq ${pgmMemberId} and isPaid eq false`,
          $select: 'id,totalAmount',
          $top: 20,
        }),
      ]);

      const m = memberRes.status === 'fulfilled' ? memberRes.value.value?.[0] : null;
      const invs = invoicesRes.status === 'fulfilled' ? (invoicesRes.value.value ?? []) : [];
      const outstanding = invs.reduce((s: number, i: any) => s + (i.totalAmount ?? 0), 0);
      const name = m ? `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || null : null;

      return { name, outstanding };
    } catch {
      return { name: null, outstanding: 0 };
    }
  }

  private async fetchActiveContract(pgmMemberId: number): Promise<{ planName: string | null; endDate: string } | null> {
    try {
      const [contractRes, plansRes] = await Promise.allSettled([
        this.pgm.get<{ value: any[] }>('/odata/Contracts', {
          $filter: `memberId eq ${pgmMemberId} and isDeleted eq false and endDate ge datetime'${new Date().toISOString().slice(0, 10)}T00:00:00'`,
          $orderby: 'endDate desc',
          $select: 'id,paymentPlanId,endDate',
          $top: 1,
        }),
        this.pgm.get<{ value: any[] }>('/odata/PaymentPlans', { $select: 'id,name' }),
      ]);

      const c = contractRes.status === 'fulfilled' ? contractRes.value.value?.[0] : null;
      if (!c) return null;

      const planMap = new Map<number, string>();
      if (plansRes.status === 'fulfilled') {
        for (const p of (plansRes.value.value ?? [])) planMap.set(p.id, p.name);
      }

      return { planName: planMap.get(c.paymentPlanId) ?? null, endDate: c.endDate };
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

  private isCardExpired(month: string | null, year: string | null): boolean {
    if (!month || !year) return false;
    const now = new Date();
    const expYear  = parseInt(year,  10);
    const expMonth = parseInt(month, 10);
    if (isNaN(expYear) || isNaN(expMonth)) return false;
    // Card expires at end of expiry month
    return expYear < now.getFullYear() ||
      (expYear === now.getFullYear() && expMonth < now.getMonth() + 1);
  }

  private async fetchTotalVisits(pgmMemberId: number): Promise<number> {
    try {
      const res = await this.pgm.get<{ value: any[] }>('/odata/Visits', {
        $filter: `memberId eq ${pgmMemberId}`,
        $select: 'id',
        $top: 500,
      });
      return res.value?.length ?? 0;
    } catch { return 0; }
  }

  private async fetchStreak(pgmMemberId: number, userId: string): Promise<number> {
    try {
      const since = new Date();
      since.setFullYear(since.getFullYear() - 1);

      const [visitsRes, classesRes] = await Promise.allSettled([
        this.pgm.get<{ value: any[] }>('/odata/Visits', {
          $filter: `memberId eq ${pgmMemberId} and enterDate ge datetime'${since.toISOString().slice(0, 19)}'`,
          $select: 'enterDate',
          $top: 500,
        }),
        this.bookingRepo.find({
          where: { userId, status: 'attended' },
          select: ['createdAt'],
        }),
      ]);

      const weekKeys = new Set<string>();

      if (visitsRes.status === 'fulfilled') {
        for (const v of visitsRes.value.value ?? []) {
          weekKeys.add(this.isoWeek(new Date(v.enterDate)));
        }
      }
      if (classesRes.status === 'fulfilled') {
        for (const b of classesRes.value) {
          weekKeys.add(this.isoWeek(new Date(b.createdAt)));
        }
      }

      let streak = 0;
      const now = new Date();
      for (let w = 0; w < 52; w++) {
        const check = new Date(now);
        check.setDate(check.getDate() - w * 7);
        if (weekKeys.has(this.isoWeek(check))) streak++;
        else break;
      }
      return streak;
    } catch { return 0; }
  }

  private isoWeek(d: Date): string {
    const tmp = new Date(d);
    tmp.setHours(0, 0, 0, 0);
    tmp.setDate(tmp.getDate() - ((tmp.getDay() + 6) % 7)); // Monday
    return tmp.toISOString().slice(0, 10);
  }

  private async fetchNextBooking(userId: string): Promise<DashboardData['nextClass']> {
    const today = new Date().toISOString().slice(0, 10);

    const confirmed = await this.bookingRepo
      .createQueryBuilder('b')
      .where('b.user_id = :userId', { userId })
      .andWhere('b.status = :status', { status: 'confirmed' })
      .andWhere('(b.class_date >= :today OR b.class_date IS NULL)', { today })
      .orderBy('b.class_date', 'ASC')
      .addOrderBy('b.created_at', 'ASC')
      .limit(20)
      .getMany();

    if (confirmed.length === 0) return null;

    for (const booking of confirmed) {
      try {
        const cls = await this.bookingAdapter.getClass(booking.classId);
        const startMs = new Date(cls.startTime).getTime();
        if (startMs > Date.now()) {
          return {
            bookingId: booking.id,
            classId: booking.classId,
            className: cls.name,
            startTime: cls.startTime,
            minutesUntil: Math.max(0, Math.floor((startMs - Date.now()) / 60000)),
            clubName: cls.clubName,
          };
        }
      } catch { /* skip */ }
    }

    return null;
  }
}
