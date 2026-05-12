import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { Repository } from 'typeorm';
import { PgmAuthAdapter, PgmCodeDestination } from '../pgm-adapter/pgm-auth.adapter';
import { AppError } from '../pgm-adapter/error-normalize';
import { Session } from './entities/session.entity';
import { User } from './entities/user.entity';
import { JwtPayload } from './jwt.strategy';

const REFRESH_TTL_DAYS = 30;
const ACCESS_TTL = '15m';

export interface IssueTokenResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; pgmId: number; role: string; email: string | null };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Session) private readonly sessionRepo: Repository<Session>,
    private readonly pgm: PgmAuthAdapter,
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
  ) {
    // CRITICAL: fail-fast on missing/weak JWT_SECRET
    const secret = this.cfg.get<string>('JWT_SECRET');
    if (!secret || secret.length < 32 || secret === 'change-me-to-a-long-random-string') {
      throw new Error('JWT_SECRET not configured or too weak (need >= 32 chars)');
    }
    this.jwtSecret = secret;
  }

  /** Option A — email + password via PGM VerifyMemberCredentials */
  async login(input: {
    email: string;
    password: string;
    deviceFingerprint?: string;
    devicePlatform?: string;
  }): Promise<IssueTokenResult> {
    const result = await this.pgm.verifyMemberCredentials(input.email, input.password);
    if (!result?.memberId) throw new AppError('INVALID_CREDENTIALS');

    const status = (result.status || '').toLowerCase();
    // Wrong password: PGM returns status=InvalidUsernameOrPassword with a memberId
    if (status.includes('invalid') || status.includes('username') || status.includes('password')) {
      throw new AppError('INVALID_CREDENTIALS');
    }
    // Inactive/suspended member
    if (status !== 'active' && status !== 'success') {
      throw new AppError('MEMBER_INACTIVE', `status=${result.status || 'unknown'}`);
    }

    const user = await this.upsertUser({
      pgmMemberId: result.memberId,
      email: input.email,
      status: 'active',
    });

    return this.issueTokens(user, input.deviceFingerprint, input.devicePlatform);
  }

  /** Option B step 1 — request OTP. Returns signed memberIdToken to use in step 2. */
  async requestOtp(email: string): Promise<{ memberIdToken: string }> {
    const memberId = await this.pgm.lookupMemberIdByEmail(email);
    if (!memberId) throw new AppError('NOT_FOUND', 'no member with this email');

    const codeDestination = (this.cfg.get<string>('PGM_OTP_DESTINATION') ?? 'Email') as PgmCodeDestination;
    await this.pgm.sendOneTimeCode(memberId, codeDestination);

    return { memberIdToken: this.signMemberIdToken(memberId) };
  }

  /** Option B step 2 — verify OTP and issue JWT */
  async verifyOtp(input: {
    memberIdToken: string;
    code: string;
    deviceFingerprint?: string;
  }): Promise<IssueTokenResult> {
    const memberId = this.verifyMemberIdToken(input.memberIdToken);
    const r = await this.pgm.verifyOneTimeCode(memberId, input.code);
    if (!r.codeMatches) throw new AppError('INVALID_OTP');

    const user = await this.upsertUser({ pgmMemberId: memberId, status: 'active' });
    return this.issueTokens(user, input.deviceFingerprint);
  }

  /**
   * Refresh + rotate (atomic).
   * Uses conditional UPDATE-RETURNING to prevent concurrent-refresh race.
   * If two requests come in with same token, only one UPDATE wins (revoked=true);
   * the other gets 0 rows → treated as replay attempt → revoke all sessions.
   */
  async refresh(refreshToken: string): Promise<IssueTokenResult> {
    const hash = this.hashRefresh(refreshToken);

    // Atomic claim: only one request can flip revoked false→true
    const claimResult = await this.sessionRepo
      .createQueryBuilder()
      .update(Session)
      .set({ revoked: true })
      .where('refresh_token_hash = :hash AND revoked = false AND expires_at > NOW()', { hash })
      .returning(['id', 'userId', 'deviceFingerprint', 'devicePlatform'])
      .execute();

    const claimed = (claimResult.raw as Array<{ id: string; user_id: string; device_fingerprint: string | null; device_platform: string | null }>)[0];

    if (!claimed) {
      // No row updated → either token doesn't exist, expired, OR already revoked (replay)
      const existing = await this.sessionRepo.findOne({ where: { refreshTokenHash: hash } });
      if (existing?.revoked) {
        // Token was previously revoked AND someone is using it again → likely theft
        await this.sessionRepo.update({ userId: existing.userId }, { revoked: true });
        this.logger.warn({ event: 'refresh_replay_attempt', userId: existing.userId, sessionId: existing.id });
      }
      throw new UnauthorizedException('invalid refresh token');
    }

    const user = await this.userRepo.findOneOrFail({ where: { id: claimed.user_id } });
    return this.issueTokens(user, claimed.device_fingerprint ?? undefined, claimed.device_platform ?? undefined);
  }

  async logout(refreshToken: string): Promise<void> {
    const hash = this.hashRefresh(refreshToken);
    await this.sessionRepo.update({ refreshTokenHash: hash }, { revoked: true });
  }

  async getMe(userId: string): Promise<User> {
    return this.userRepo.findOneOrFail({ where: { id: userId } });
  }

  /** ─── helpers ─── */

  private async upsertUser(input: {
    pgmMemberId: number;
    email?: string;
    status: 'active' | 'inactive' | 'frozen';
  }): Promise<User> {
    let user = await this.userRepo.findOne({ where: { pgmMemberId: input.pgmMemberId } });
    if (!user) {
      user = this.userRepo.create({
        pgmMemberId: input.pgmMemberId,
        email: input.email ?? null,
        role: 'member',
        status: input.status,
        lastPgmSyncAt: new Date(),
      });
    } else {
      user.email = input.email ?? user.email;
      user.status = input.status;
      user.lastPgmSyncAt = new Date();
    }

    // Backfill memberCode (PGM user_number) if missing
    if (!user.memberCode) {
      const memberNumber = await this.pgm.getMemberNumber(input.pgmMemberId);
      if (memberNumber) user.memberCode = memberNumber;
    }

    return this.userRepo.save(user);
  }

  private async issueTokens(
    user: User,
    deviceFingerprint?: string,
    devicePlatform?: string,
  ): Promise<IssueTokenResult> {
    const jti = randomUUID();
    const payload: JwtPayload = {
      sub: user.id,
      pgmId: user.pgmMemberId,
      role: user.role,
      jti,
    };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: ACCESS_TTL });
    const refreshToken = randomBytes(64).toString('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS);

    await this.sessionRepo.save(
      this.sessionRepo.create({
        userId: user.id,
        refreshTokenHash: this.hashRefresh(refreshToken),
        deviceFingerprint: deviceFingerprint ?? null,
        devicePlatform: devicePlatform ?? null,
        expiresAt,
        lastSeenAt: new Date(),
      }),
    );

    // (Housekeeping cleanup of expired sessions moved to a scheduled job — Stage 1.5)

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, pgmId: user.pgmMemberId, role: user.role, email: user.email },
    };
  }

  private hashRefresh(raw: string): string {
    return createHmac('sha256', this.jwtSecret)
      .update(raw)
      .digest('hex');
  }

  /** memberIdToken: HMAC-signed payload {memberId, exp} for /request-otp → /verify-otp handoff */
  private signMemberIdToken(memberId: number): string {
    const exp = Date.now() + 15 * 60 * 1000;
    const body = `${memberId}.${exp}`;
    const sig = createHmac('sha256', this.cfg.get<string>('JWT_SECRET') ?? 'fallback')
      .update(body)
      .digest('hex')
      .slice(0, 32);
    return Buffer.from(`${body}.${sig}`).toString('base64url');
  }

  private verifyMemberIdToken(token: string): number {
    let body: string;
    try {
      body = Buffer.from(token, 'base64url').toString('utf8');
    } catch {
      throw new AppError('INVALID_OTP', 'malformed token');
    }
    const parts = body.split('.');
    if (parts.length !== 3) throw new AppError('INVALID_OTP', 'malformed token');
    const [memberIdStr, expStr, sig] = parts;
    if (!memberIdStr || !expStr || !sig) throw new AppError('INVALID_OTP', 'malformed token');
    const expected = createHmac('sha256', this.cfg.get<string>('JWT_SECRET') ?? 'fallback')
      .update(`${memberIdStr}.${expStr}`)
      .digest('hex')
      .slice(0, 32);
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(sig);
    if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
      throw new AppError('INVALID_OTP', 'invalid token');
    }
    if (Date.now() > Number(expStr)) throw new AppError('OTP_EXPIRED');
    const memberId = Number(memberIdStr);
    if (!Number.isFinite(memberId)) throw new AppError('INVALID_OTP', 'malformed token');
    return memberId;
  }

  // ── Public methods for SignupService ──────────────────────────────────────

  /**
   * Create a brand-new user row (for signup flow — PGM member already created externally).
   * Uses upsertUser so it's idempotent if called twice with same pgmMemberId.
   */
  async createUser(input: {
    pgmMemberId: number;
    email: string | null;
    phone: string | null;
  }): Promise<User> {
    let user = await this.userRepo.findOne({ where: { pgmMemberId: input.pgmMemberId } });
    if (!user) {
      user = this.userRepo.create({
        pgmMemberId: input.pgmMemberId,
        email: input.email,
        phone: input.phone,
        role: 'member',
        status: 'active',
        lastPgmSyncAt: new Date(),
      });
    } else {
      user.email  = input.email  ?? user.email;
      user.phone  = input.phone  ?? user.phone;
      user.status = 'active';
      user.lastPgmSyncAt = new Date();
    }
    return this.userRepo.save(user);
  }

  /** Issue JWT tokens for a newly-created user (called by SignupService). */
  async issueTokensForNewUser(user: User): Promise<IssueTokenResult> {
    return this.issueTokens(user);
  }
}

