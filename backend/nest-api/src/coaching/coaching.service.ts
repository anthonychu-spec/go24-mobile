import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { BrandService } from '../brand/brand.service';
import type { BrandId } from '../brand/brand.constants';
import { CoachingEnquiry } from './coaching-enquiry.entity';

/** Enquiries one member may send per rolling 24 hours */
export const DAILY_ENQUIRY_LIMIT = 3;

export interface EnquiryInput {
  userId: string;
  pgmMemberId: number;
  brand: BrandId;
  clubId: number;
  goal: string;
  preferredTimes?: string;
  notes?: string;
}

/**
 * Coaching enquiries (backend-plan N3). Stored first; telling the front desk is a
 * separate, switchable step because where enquiries go is still undecided (B4).
 * Notification runs only when COACHING_NOTIFY_ENABLED=true and
 * COACHING_NOTIFY_WEBHOOK_URL is set (e.g. an n8n webhook) — off by default.
 */
@Injectable()
export class CoachingService {
  private readonly logger = new Logger(CoachingService.name);

  constructor(
    @InjectRepository(CoachingEnquiry) private readonly repo: Repository<CoachingEnquiry>,
    private readonly brands: BrandService,
    private readonly cfg: ConfigService,
  ) {}

  async create(input: EnquiryInput): Promise<{ id: string; status: string; message: string }> {
    // Another brand's club is reported as unknown, like classes
    if (!(await this.brands.ownsClub(input.brand, input.clubId))) throw new NotFoundException({ code: 'CLUB_NOT_FOUND' });

    const since = new Date(Date.now() - 24 * 3600_000);
    const recent = await this.repo.count({ where: { userId: input.userId, createdAt: MoreThan(since) } });
    if (recent >= DAILY_ENQUIRY_LIMIT) {
      throw new HttpException(
        { code: 'RATE_LIMITED', message: 'You have sent several enquiries today; the team will be in touch' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const enquiry = await this.repo.save(this.repo.create({
      userId: input.userId,
      brand: input.brand,
      clubId: input.clubId,
      goal: input.goal,
      preferredTimes: input.preferredTimes ?? null,
      notes: input.notes ?? null,
      status: 'received',
    }));

    await this.notify(enquiry, input.pgmMemberId);

    return {
      id: enquiry.id,
      status: enquiry.status,
      // Honest: storing it doesn't mean anyone has seen it yet
      message: 'Enquiry received. No coach has contacted you yet — the team will get back to you.',
    };
  }

  async listMine(userId: string, brand: BrandId): Promise<CoachingEnquiry[]> {
    return this.repo.find({ where: { userId, brand }, order: { createdAt: 'DESC' }, take: 20 });
  }

  private async notify(enquiry: CoachingEnquiry, pgmMemberId: number): Promise<void> {
    const url = this.cfg.get<string>('COACHING_NOTIFY_WEBHOOK_URL');
    if (this.cfg.get<string>('COACHING_NOTIFY_ENABLED') !== 'true' || !url) return;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Member identified by PGM id only; the front desk looks the person up in PGM
        body: JSON.stringify({
          enquiryId: enquiry.id, brand: enquiry.brand, clubId: enquiry.clubId, pgmMemberId,
          goal: enquiry.goal, preferredTimes: enquiry.preferredTimes, notes: enquiry.notes,
          createdAt: enquiry.createdAt,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await this.repo.update({ id: enquiry.id }, { notifiedAt: new Date() });
    } catch (err) {
      // Stored either way; notified_at stays null so a missed one can be found and resent
      this.logger.warn(`Coaching enquiry ${enquiry.id} stored but notify failed: ${(err as Error).message}`);
    }
  }
}
