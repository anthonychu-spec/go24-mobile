import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AppError } from '../pgm-adapter/error-normalize';
import { PgmAuthAdapter } from '../pgm-adapter/pgm-auth.adapter';

const SECRET = 'x'.repeat(40);

const pgm = {
  verifyMemberCredentials: jest.fn(),
  lookupMemberIdByEmail: jest.fn(),
  sendOneTimeCode: jest.fn(),
  verifyOneTimeCode: jest.fn(),
  getMemberStatus: jest.fn(),
  getMemberNumber: jest.fn().mockResolvedValue('M-1'),
};
const userRepo = {
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  create: jest.fn((u: object) => ({ ...u })),
  save: jest.fn(async (u: object) => ({ id: 'user-1', role: 'member', ...u })),
};
const claimExecute = jest.fn();
const sessionRepo = {
  create: jest.fn((s: object) => ({ ...s })),
  save: jest.fn(async (s: object) => ({ id: 'session-1', ...s })),
  findOne: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(() => {
    const qb: any = {};
    for (const m of ['update', 'set', 'where', 'returning']) qb[m] = jest.fn(() => qb);
    qb.execute = claimExecute;
    return qb;
  }),
};
const sessionValidator = { forget: jest.fn() };
const deviceTokenRepo = { delete: jest.fn() };
const cfg = { get: (k: string) => (k === 'JWT_SECRET' ? SECRET : undefined) };
const jwt = new JwtService({ secret: SECRET });

const svc = new AuthService(
  userRepo as any, sessionRepo as any, deviceTokenRepo as any, pgm as any, jwt, cfg as any, sessionValidator as any,
);

const ACTIVE = { exists: true, isActive: true, isDeleted: false };

beforeEach(() => jest.clearAllMocks());

async function otpToken(memberId: number): Promise<string> {
  pgm.lookupMemberIdByEmail.mockResolvedValueOnce(memberId);
  pgm.sendOneTimeCode.mockResolvedValueOnce(undefined);
  return (await svc.requestOtp('a@b.co')).memberIdToken;
}

describe('AuthService.login', () => {
  it('rejects a correct password when the PGM member is no longer active', async () => {
    pgm.verifyMemberCredentials.mockResolvedValueOnce({ memberId: 7, status: 'Active' });
    pgm.getMemberStatus.mockResolvedValueOnce({ exists: true, isActive: false, isDeleted: false });
    await expect(svc.login({ email: 'a@b.co', password: 'secret1' })).rejects.toMatchObject({ code: 'MEMBER_INACTIVE' });
    expect(sessionRepo.save).not.toHaveBeenCalled();
  });

  it('issues an access token that carries the session id', async () => {
    pgm.verifyMemberCredentials.mockResolvedValueOnce({ memberId: 7, status: 'Active' });
    pgm.getMemberStatus.mockResolvedValueOnce(ACTIVE);
    userRepo.findOne.mockResolvedValueOnce(null);
    const res = await svc.login({ email: 'a@b.co', password: 'secret1' });
    const payload = jwt.decode(res.accessToken) as { sid: string; sub: string; brand: string };
    expect(payload.sid).toBe('session-1');
    expect(payload.sub).toBe('user-1');
    expect(payload.brand).toBe('go24'); // no header → default brand
  });

  it('records the app brand on the session and in the token', async () => {
    pgm.verifyMemberCredentials.mockResolvedValueOnce({ memberId: 7, status: 'Active' });
    pgm.getMemberStatus.mockResolvedValueOnce(ACTIVE);
    userRepo.findOne.mockResolvedValueOnce(null);
    const res = await svc.login({ email: 'a@b.co', password: 'secret1', brand: 'lab' });
    expect(sessionRepo.create).toHaveBeenCalledWith(expect.objectContaining({ brand: 'lab' }));
    expect((jwt.decode(res.accessToken) as { brand: string }).brand).toBe('lab');
  });
});

describe('AuthService OTP', () => {
  it('passes AMBIGUOUS_ACCOUNT through when an email belongs to several members', async () => {
    pgm.lookupMemberIdByEmail.mockRejectedValueOnce(new AppError('AMBIGUOUS_ACCOUNT'));
    await expect(svc.requestOtp('shared@b.co')).rejects.toMatchObject({ code: 'AMBIGUOUS_ACCOUNT' });
    expect(pgm.sendOneTimeCode).not.toHaveBeenCalled();
  });

  it('rejects a matching code for an inactive member', async () => {
    const token = await otpToken(7);
    pgm.verifyOneTimeCode.mockResolvedValueOnce({ codeMatches: true, memberId: 7 });
    pgm.getMemberStatus.mockResolvedValueOnce({ exists: true, isActive: true, isDeleted: true });
    await expect(svc.verifyOtp({ memberIdToken: token, code: '1234' })).rejects.toMatchObject({ code: 'MEMBER_INACTIVE' });
    expect(sessionRepo.save).not.toHaveBeenCalled();
  });

  it('rejects when PGM says the code belongs to a different member', async () => {
    const token = await otpToken(7);
    pgm.verifyOneTimeCode.mockResolvedValueOnce({ codeMatches: true, memberId: 8 });
    await expect(svc.verifyOtp({ memberIdToken: token, code: '1234' })).rejects.toMatchObject({ code: 'INVALID_OTP' });
  });

  it('fails closed (TEMP_FAIL) when membership status cannot be checked', async () => {
    const token = await otpToken(7);
    pgm.verifyOneTimeCode.mockResolvedValueOnce({ codeMatches: true, memberId: 7 });
    pgm.getMemberStatus.mockResolvedValueOnce(null);
    await expect(svc.verifyOtp({ memberIdToken: token, code: '1234' })).rejects.toMatchObject({ code: 'TEMP_FAIL' });
  });
});

describe('AuthService.refresh', () => {
  const claimed = { raw: [{ id: 'old-session', user_id: 'user-1', device_fingerprint: null, device_platform: null, brand: 'lab' }] };

  it('keeps the brand the session was opened with', async () => {
    claimExecute.mockResolvedValueOnce(claimed);
    userRepo.findOne.mockResolvedValueOnce({ id: 'user-1', status: 'active', role: 'member', pgmMemberId: 7, lastPgmSyncAt: new Date() });
    const res = await svc.refresh('rt');
    expect((jwt.decode(res.accessToken) as { brand: string }).brand).toBe('lab');
  });

  it('refuses and revokes every session when the local user is not active', async () => {
    claimExecute.mockResolvedValueOnce(claimed);
    userRepo.findOne.mockResolvedValueOnce({ id: 'user-1', status: 'inactive', pgmMemberId: 7 });
    await expect(svc.refresh('rt')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessionRepo.update).toHaveBeenCalledWith({ userId: 'user-1' }, { revoked: true });
  });

  it('re-checks PGM after 24h and ends access when the membership lapsed', async () => {
    claimExecute.mockResolvedValueOnce(claimed);
    const user = { id: 'user-1', status: 'active', pgmMemberId: 7, lastPgmSyncAt: new Date(Date.now() - 25 * 3600_000) };
    userRepo.findOne.mockResolvedValueOnce(user);
    pgm.getMemberStatus.mockResolvedValueOnce({ exists: true, isActive: false, isDeleted: false });
    await expect(svc.refresh('rt')).rejects.toMatchObject({ code: 'MEMBER_INACTIVE' });
    expect(user.status).toBe('inactive');
    expect(sessionRepo.update).toHaveBeenCalledWith({ userId: 'user-1' }, { revoked: true });
  });

  it('does not lock members out when PGM is unreachable during the daily re-check', async () => {
    claimExecute.mockResolvedValueOnce(claimed);
    userRepo.findOne.mockResolvedValueOnce({
      id: 'user-1', status: 'active', role: 'member', pgmMemberId: 7, lastPgmSyncAt: new Date(0),
    });
    pgm.getMemberStatus.mockResolvedValueOnce(null);
    const res = await svc.refresh('rt');
    expect(res.accessToken).toBeTruthy();
  });

  it('skips the PGM check inside 24h', async () => {
    claimExecute.mockResolvedValueOnce(claimed);
    userRepo.findOne.mockResolvedValueOnce({
      id: 'user-1', status: 'active', role: 'member', pgmMemberId: 7, lastPgmSyncAt: new Date(),
    });
    await svc.refresh('rt');
    expect(pgm.getMemberStatus).not.toHaveBeenCalled();
  });
});

describe('AuthService.logout', () => {
  it('revokes the session and drops it from the validator cache', async () => {
    sessionRepo.findOne.mockResolvedValueOnce({ id: 'session-9' });
    await svc.logout('rt');
    expect(sessionRepo.update).toHaveBeenCalledWith({ id: 'session-9' }, { revoked: true });
    expect(sessionValidator.forget).toHaveBeenCalledWith('session-9');
    expect(deviceTokenRepo.delete).not.toHaveBeenCalled();
  });

  it("removes this device's push token when given", async () => {
    sessionRepo.findOne.mockResolvedValueOnce({ id: 'session-9', userId: 'user-1' });
    await svc.logout('rt', 'ExponentPushToken[abc]');
    expect(deviceTokenRepo.delete).toHaveBeenCalledWith({ userId: 'user-1', token: 'ExponentPushToken[abc]' });
  });
});

describe('PgmAuthAdapter.lookupMemberIdByEmail', () => {
  const client = { get: jest.fn() };
  const adapter = new PgmAuthAdapter(client as any);

  it('returns the member when exactly one matches', async () => {
    client.get.mockResolvedValueOnce({ value: [{ Id: 5 }] });
    await expect(adapter.lookupMemberIdByEmail('a@b.co')).resolves.toBe(5);
    expect(client.get).toHaveBeenCalledWith('/odata/Members', expect.objectContaining({ $top: 2 }));
  });

  it('refuses when more than one member shares the email', async () => {
    client.get.mockResolvedValueOnce({ value: [{ Id: 5 }, { Id: 6 }] });
    await expect(adapter.lookupMemberIdByEmail('a@b.co')).rejects.toMatchObject({ code: 'AMBIGUOUS_ACCOUNT' });
  });
});
