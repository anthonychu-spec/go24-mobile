import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { resetRateLimits } from '../common/rate-limit';
import { AppError } from '../pgm-adapter/error-normalize';
import { AccountController, AccountDeletionPageController } from './account.controller';
import { AccountDeletionService } from './account-deletion.service';
import { escapeHtml } from './account-deletion.page';

const auth = { requestOtp: jest.fn(), verifyMemberCode: jest.fn() };
const deletion = { deleteUser: jest.fn(), deleteByPgmMemberId: jest.fn() };

let app: INestApplication;

beforeAll(async () => {
  const mod = await Test.createTestingModule({
    controllers: [AccountController, AccountDeletionPageController],
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: AccountDeletionService, useValue: deletion },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({
      canActivate: (ctx: ExecutionContext) => {
        ctx.switchToHttp().getRequest().user = { id: 'u1', sessionId: 's1', brand: 'lab' };
        return true;
      },
    })
    .compile();
  app = mod.createNestApplication();
  // Same global setup as main.ts
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('v1');
  await app.init();
});

afterAll(() => app.close());

beforeEach(() => {
  jest.clearAllMocks();
  resetRateLimits();
});

const http = () => request(app.getHttpServer());

describe('POST /v1/me/account/deletion (in app)', () => {
  it('deletes the signed-in member', async () => {
    deletion.deleteUser.mockResolvedValueOnce({ deleted: true });
    await http().post('/v1/me/account/deletion').expect(200, { status: 'deleted' });
    expect(deletion.deleteUser).toHaveBeenCalledWith('u1');
  });

  it('is rate limited per member', async () => {
    deletion.deleteUser.mockResolvedValue({ deleted: false });
    for (let i = 0; i < 5; i++) await http().post('/v1/me/account/deletion').expect(200);
    await http().post('/v1/me/account/deletion').expect(429);
  });
});

describe('public deletion page', () => {
  it('serves the start page as HTML with a strict CSP and no caching', async () => {
    const res = await http().get('/v1/account-deletion?brand=lab').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.text).toContain('THE LAB by ONYX');
    expect(res.text).toContain('唔會</strong>取消你嘅會籍');
    expect(res.text).toContain('action="/v1/account-deletion/code"');
  });

  it('ignores an unknown brand instead of failing', async () => {
    const res = await http().get('/v1/account-deletion?brand=<x>').expect(200);
    expect(res.text).toContain('GO24 Group member apps');
    expect(res.text).not.toContain('<x>');
  });

  it('sends a PGM one-time code and asks for it (form post)', async () => {
    auth.requestOtp.mockResolvedValueOnce({ memberIdToken: 'tok"en' });
    const res = await http().post('/v1/account-deletion/code').type('form')
      .send({ email: ' a@b.co ', brand: 'lab' }).expect(200);
    expect(auth.requestOtp).toHaveBeenCalledWith('a@b.co');
    expect(res.text).toContain(`name="memberIdToken" value="${escapeHtml('tok"en')}"`);
    expect(res.text).toContain('name="brand" value="lab"');
  });

  it('answers an unknown email with the same code page, holding a token that never verifies', async () => {
    auth.requestOtp.mockRejectedValueOnce(new AppError('NOT_FOUND'));
    const res = await http().post('/v1/account-deletion/code').type('form').send({ email: 'x@y.co' }).expect(200);
    expect(res.text).toContain('name="memberIdToken" value=""');
  });

  it('sends a member who shares an email to the front desk', async () => {
    auth.requestOtp.mockRejectedValueOnce(new AppError('AMBIGUOUS_ACCOUNT'));
    const res = await http().post('/v1/account-deletion/code').type('form').send({ email: 'x@y.co' }).expect(409);
    expect(res.text).toContain('前台');
  });

  it('rejects a missing email without calling PGM', async () => {
    await http().post('/v1/account-deletion/code').type('form').send({}).expect(400);
    expect(auth.requestOtp).not.toHaveBeenCalled();
  });

  it('shows a page, not JSON, when PGM is down', async () => {
    auth.requestOtp.mockRejectedValueOnce(new AppError('TEMP_FAIL'));
    const res = await http().post('/v1/account-deletion/code').type('form').send({ email: 'a@b.co' }).expect(503);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('稍後再試');
  });

  it('limits code requests per IP and answers with a page', async () => {
    auth.requestOtp.mockResolvedValue({ memberIdToken: 't' });
    for (let i = 0; i < 5; i++) await http().post('/v1/account-deletion/code').type('form').send({ email: 'a@b.co' }).expect(200);
    const res = await http().post('/v1/account-deletion/code').type('form').send({ email: 'a@b.co' }).expect(429);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('deletes the account once the code checks out and the box is ticked', async () => {
    auth.verifyMemberCode.mockResolvedValueOnce(7);
    deletion.deleteByPgmMemberId.mockResolvedValueOnce({ deleted: true });
    const res = await http().post('/v1/account-deletion/confirm').type('form')
      .send({ memberIdToken: 't', code: '123456', confirm: 'yes', brand: 'lab' }).expect(200);
    expect(auth.verifyMemberCode).toHaveBeenCalledWith('t', '123456');
    expect(deletion.deleteByPgmMemberId).toHaveBeenCalledWith(7);
    expect(res.text).toContain('你嘅 app 帳戶已經刪除');
  });

  it('says so when the member has no app account', async () => {
    auth.verifyMemberCode.mockResolvedValueOnce(7);
    deletion.deleteByPgmMemberId.mockResolvedValueOnce({ deleted: false });
    const res = await http().post('/v1/account-deletion/confirm').type('form')
      .send({ memberIdToken: 't', code: '123456', confirm: 'yes' }).expect(200);
    expect(res.text).toContain('搵唔到');
  });

  it('does not delete without the confirmation box', async () => {
    await http().post('/v1/account-deletion/confirm').type('form').send({ memberIdToken: 't', code: '123456' }).expect(400);
    expect(auth.verifyMemberCode).not.toHaveBeenCalled();
    expect(deletion.deleteByPgmMemberId).not.toHaveBeenCalled();
  });

  it('does not delete on a wrong code, and lets the member try again', async () => {
    auth.verifyMemberCode.mockRejectedValueOnce(new AppError('INVALID_OTP'));
    const res = await http().post('/v1/account-deletion/confirm').type('form')
      .send({ memberIdToken: 't', code: '000000', confirm: 'yes' }).expect(400);
    expect(deletion.deleteByPgmMemberId).not.toHaveBeenCalled();
    expect(res.text).toContain('name="memberIdToken" value="t"');
  });

  it('rejects the decoy token of an unknown email without calling PGM', async () => {
    await http().post('/v1/account-deletion/confirm').type('form')
      .send({ memberIdToken: '', code: '123456', confirm: 'yes' }).expect(400);
    expect(auth.verifyMemberCode).not.toHaveBeenCalled();
  });

  it('sends the member back to the start when the code has expired', async () => {
    auth.verifyMemberCode.mockRejectedValueOnce(new AppError('OTP_EXPIRED'));
    const res = await http().post('/v1/account-deletion/confirm').type('form')
      .send({ memberIdToken: 't', code: '123456', confirm: 'yes' }).expect(410);
    expect(res.text).toContain('action="/v1/account-deletion/code"');
    expect(deletion.deleteByPgmMemberId).not.toHaveBeenCalled();
  });

  it('limits confirm attempts per IP', async () => {
    auth.verifyMemberCode.mockRejectedValue(new AppError('INVALID_OTP'));
    const send = () => http().post('/v1/account-deletion/confirm').type('form').send({ memberIdToken: 't', code: '1', confirm: 'yes' });
    for (let i = 0; i < 10; i++) await send().expect(400);
    await send().expect(429);
  });
});
