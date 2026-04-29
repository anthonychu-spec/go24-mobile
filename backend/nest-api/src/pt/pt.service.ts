import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PgmClient } from '../pgm-adapter/pgm.client';
import { PtLog } from './entities/pt-log.entity';

@Injectable()
export class PtService {
  private readonly logger = new Logger(PtService.name);

  constructor(
    @InjectRepository(PtLog) private readonly logRepo: Repository<PtLog>,
    private readonly pgm: PgmClient,
  ) {}

  async getAgreements(pgmMemberId: number) {
    try {
      const res = await this.pgm.get<{ value: any[] }>('/odata/PtAgreements', {
        $filter: `memberId eq ${pgmMemberId} and isDeleted eq false`,
        $select: 'id,memberId,trainerId,totalSessions,usedSessions,remainingSessions,startDate,endDate,status',
        $orderby: 'startDate desc',
        $top: 20,
      });
      return res.value ?? [];
    } catch (err) {
      this.logger.warn('PGM PT agreements fetch failed', err);
      return [];
    }
  }

  async getSessions(pgmMemberId: number) {
    try {
      const res = await this.pgm.get<{ value: any[] }>('/odata/PtAgreementUsages', {
        $filter: `memberId eq ${pgmMemberId}`,
        $select: 'id,memberId,trainerId,agreementId,date,status',
        $orderby: 'date desc',
        $top: 50,
      });

      const sessions = res.value ?? [];

      // Merge with our verification logs
      const logs = await this.logRepo.find({ where: { userId: String(pgmMemberId) } });
      const verifiedIds = new Set(logs.map(l => l.pgmSessionId));

      return sessions.map((s: any) => ({
        ...s,
        verified: verifiedIds.has(String(s.id)),
      }));
    } catch (err) {
      this.logger.warn('PGM PT sessions fetch failed', err);
      return [];
    }
  }

  async verifySession(input: {
    userId: string;
    pgmSessionId: string;
    pgmTrainerId?: number;
    agreementId?: number;
    signature: string;
    notes?: string;
  }): Promise<PtLog> {
    // Check not already verified
    const existing = await this.logRepo.findOne({
      where: { userId: input.userId, pgmSessionId: input.pgmSessionId },
    });
    if (existing) throw new ConflictException('Session already verified');

    const log = this.logRepo.create({
      userId: input.userId,
      pgmSessionId: input.pgmSessionId,
      pgmTrainerId: input.pgmTrainerId ?? null,
      agreementId: input.agreementId ?? null,
      signedAt: new Date(),
      signature: input.signature,
      notes: input.notes ?? null,
    });

    return this.logRepo.save(log);
  }

  async getMyLogs(userId: string): Promise<PtLog[]> {
    return this.logRepo.find({
      where: { userId },
      order: { signedAt: 'DESC' },
      take: 50,
    });
  }
}
