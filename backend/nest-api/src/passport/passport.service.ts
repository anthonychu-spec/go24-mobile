import { Injectable, Logger } from '@nestjs/common';
import { PgmClient } from '../pgm-adapter/pgm.client';
import { BrandService } from '../brand/brand.service';
import type { BrandId } from '../brand/brand.constants';
import { SettingsService } from '../settings/settings.service';

const HK_OFFSET_MS = 8 * 3600_000; // Hong Kong has no DST
const WEEK_MS = 7 * 86_400_000;
const LOOKBACK_WEEKS = 26;

export interface PassportVisits {
  /** YYYY-MM in Hong Kong time */
  month: string;
  /** Visits to this brand's clubs this month; null when PGM could not be read (not zero) */
  visitsThisMonth: number | null;
  /** Consecutive weeks (Mon–Sun, HK) with at least one visit; null when PGM could not be read */
  weeksInARow: number | null;
  visitGoal: number | null;
}

/** Start of the Hong Kong week (Monday 00:00 HKT) containing `t`, as a UTC epoch ms key */
export function hkWeekStart(t: number): number {
  const hk = new Date(t + HK_OFFSET_MS);
  const day = (hk.getUTCDay() + 6) % 7; // Monday = 0
  return Date.UTC(hk.getUTCFullYear(), hk.getUTCMonth(), hk.getUTCDate() - day) - HK_OFFSET_MS;
}

/** Start of the Hong Kong calendar month containing `t` */
export function hkMonthStart(t: number): { start: Date; label: string } {
  const hk = new Date(t + HK_OFFSET_MS);
  const y = hk.getUTCFullYear();
  const m = hk.getUTCMonth();
  return { start: new Date(Date.UTC(y, m, 1) - HK_OFFSET_MS), label: `${y}-${String(m + 1).padStart(2, '0')}` };
}

/**
 * Weeks in a row with a visit, counting back from this week. A week not yet visited
 * doesn't break the run until it is over, so on a Monday last week's run still shows.
 */
export function weeksInARow(visitTimes: number[], now: number): number {
  const weeks = new Set(visitTimes.map(hkWeekStart));
  let week = hkWeekStart(now);
  if (!weeks.has(week)) week -= WEEK_MS;
  let run = 0;
  while (weeks.has(week)) {
    run++;
    week -= WEEK_MS;
  }
  return run;
}

/**
 * Passport visit numbers (backend-plan N6), from PGM MemberClubVisits — which the
 * BioStar → PGM n8n workflow fills. Only the brand's own clubs count. LAB visits
 * appear once that workflow has LAB's turnstile rules (gate M8).
 */
@Injectable()
export class PassportService {
  private readonly logger = new Logger(PassportService.name);

  constructor(
    private readonly pgm: PgmClient,
    private readonly brands: BrandService,
    private readonly settings: SettingsService,
  ) {}

  async visits(userId: string, pgmMemberId: number, brand: BrandId, now = Date.now()): Promise<PassportVisits> {
    const month = hkMonthStart(now);
    const [visitTimes, settings] = await Promise.all([
      this.fetchVisitTimes(pgmMemberId, brand, now),
      this.settings.get(userId),
    ]);
    return {
      month: month.label,
      visitsThisMonth: visitTimes ? visitTimes.filter(t => t >= month.start.getTime()).length : null,
      weeksInARow: visitTimes ? weeksInARow(visitTimes, now) : null,
      visitGoal: settings.visitGoal ?? null,
    };
  }

  /** Visit times (epoch ms) at the brand's clubs over the lookback, or null if PGM failed */
  private async fetchVisitTimes(pgmMemberId: number, brand: BrandId, now: number): Promise<number[] | null> {
    const clubs = await this.brands.clubIds(brand);
    if (clubs.length === 0) return [];
    const since = new Date(hkWeekStart(now) - LOOKBACK_WEEKS * WEEK_MS).toISOString().slice(0, 19);
    try {
      const res = await this.pgm.get<{ value?: Array<{ enterDate: string }> }>('/odata/MemberClubVisits', {
        $filter: `memberId eq ${pgmMemberId} and enterDate ge ${since}Z and (${clubs.map(c => `clubId eq ${c}`).join(' or ')})`,
        $select: 'enterDate',
        $top: 500,
      });
      return (res.value ?? []).map(v => new Date(v.enterDate).getTime()).filter(t => !Number.isNaN(t));
    } catch (err) {
      this.logger.warn(`Passport visits unavailable for member ${pgmMemberId}: ${(err as Error).message}`);
      return null;
    }
  }
}
