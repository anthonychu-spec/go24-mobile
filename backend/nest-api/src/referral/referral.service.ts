import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Referral } from './entities/referral.entity';

const APP_BASE_URL = process.env.APP_BASE_URL ?? 'https://go24.app';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'GO24-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

@Injectable()
export class ReferralService {
  constructor(
    @InjectRepository(Referral) private readonly repo: Repository<Referral>,
  ) {}

  async getMyReferral(userId: string): Promise<{
    code: string;
    link: string;
    totalReferred: number;
    completed: number;
    rewarded: number;
  }> {
    let referral = await this.repo.findOne({ where: { referrerId: userId } });

    if (!referral) {
      // Generate unique code
      let code = generateCode();
      let exists = await this.repo.findOne({ where: { referrerCode: code } });
      while (exists) { code = generateCode(); exists = await this.repo.findOne({ where: { referrerCode: code } }); }

      referral = await this.repo.save(this.repo.create({ referrerId: userId, referrerCode: code }));
    }

    const all = await this.repo.find({ where: { referrerCode: referral.referrerCode } });
    const completed = all.filter(r => r.status !== 'pending').length;
    const rewarded = all.filter(r => r.status === 'rewarded').length;
    const totalReferred = all.filter(r => r.referredUserId).length;

    return {
      code: referral.referrerCode,
      link: `${APP_BASE_URL}/join?ref=${referral.referrerCode}`,
      totalReferred,
      completed,
      rewarded,
    };
  }

  async recordReferral(referrerCode: string, referredUserId: string): Promise<void> {
    const referral = await this.repo.findOne({ where: { referrerCode } });
    if (!referral || referral.referredUserId) return; // already used or not found

    referral.referredUserId = referredUserId;
    referral.status = 'completed';
    referral.completedAt = new Date();
    await this.repo.save(referral);
  }

  async listReferrals(adminSecret: string): Promise<Referral[]> {
    if (adminSecret !== (process.env.BROADCAST_SECRET ?? '')) throw new Error('Unauthorized');
    return this.repo.find({ order: { createdAt: 'DESC' }, take: 200 });
  }
}
