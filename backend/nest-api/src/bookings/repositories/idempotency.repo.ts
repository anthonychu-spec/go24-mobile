import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdempotencyKey } from '../entities/idempotency-key.entity';

export type ClaimResult =
  | { kind: 'claimed' }
  | { kind: 'already_done'; response: Record<string, unknown> }
  | { kind: 'in_flight' };

@Injectable()
export class IdempotencyRepository {
  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly repo: Repository<IdempotencyKey>,
  ) {}

  async tryClaim(userId: string, key: string, endpoint: string): Promise<ClaimResult> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Atomic INSERT ON CONFLICT DO NOTHING — only one concurrent caller wins
    const inserted: { user_id: string }[] = await this.repo.manager.query(
      `INSERT INTO idempotency_keys (user_id, key, endpoint, status, expires_at)
       VALUES ($1, $2, $3, 'in_flight', $4)
       ON CONFLICT (user_id, key) DO NOTHING
       RETURNING user_id`,
      [userId, key, endpoint, expiresAt],
    );

    if (inserted.length > 0) return { kind: 'claimed' };

    // Already exists — read current state
    const existing = await this.repo.findOne({ where: { userId, key } });
    if (!existing) return { kind: 'claimed' }; // race gap — treat as claimed

    if (existing.status === 'done' && existing.resultKind === 'terminal' && existing.response) {
      return { kind: 'already_done', response: existing.response };
    }
    return { kind: 'in_flight' };
  }

  async complete(
    userId: string,
    key: string,
    response: Record<string, unknown>,
    resultKind: 'terminal' | 'transient',
  ): Promise<void> {
    await this.repo.update(
      { userId, key },
      { status: 'done', response: response as any, resultKind, completedAt: new Date() },
    );
  }

  async cleanExpired(): Promise<void> {
    await this.repo.manager.query(
      `DELETE FROM idempotency_keys WHERE expires_at < NOW()`,
    );
  }
}
