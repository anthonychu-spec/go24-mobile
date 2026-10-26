import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from './entities/session.entity';
import { User } from './entities/user.entity';

const CACHE_TTL_MS = 30_000;
const CACHE_MAX = 10_000;

/**
 * Checks on every authenticated request that the access token's session is still
 * live and its user still active, so logout, account deletion or a lapsed
 * membership take effect within ~30 s instead of when the 15-min token expires.
 */
@Injectable()
export class SessionValidator {
  private readonly cache = new Map<string, { valid: boolean; expiresAt: number }>();

  constructor(
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async isValid(sessionId: string, userId: string): Promise<boolean> {
    const now = Date.now();
    const hit = this.cache.get(sessionId);
    if (hit && hit.expiresAt > now) return hit.valid;

    const session = await this.sessions.findOne({ where: { id: sessionId } });
    let valid = !!session && session.userId === userId && !session.revoked && session.expiresAt.getTime() > now;
    if (valid) {
      const user = await this.users.findOne({ where: { id: userId } });
      valid = user?.status === 'active';
    }

    if (this.cache.size >= CACHE_MAX) this.cache.clear();
    this.cache.set(sessionId, { valid, expiresAt: now + CACHE_TTL_MS });
    return valid;
  }

  /** Drop a cached answer right away (logout in this process). */
  forget(sessionId: string): void {
    this.cache.delete(sessionId);
  }
}
