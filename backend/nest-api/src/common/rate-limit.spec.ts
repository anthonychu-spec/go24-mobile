import { HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard, RateLimitOptions, resetRateLimits } from './rate-limit';

class Ctl {}
const handler = function handler() {};

function ctx(opts: RateLimitOptions | undefined, req: Record<string, unknown>) {
  const reflector = { get: () => opts } as unknown as Reflector;
  const res = { setHeader: jest.fn() };
  const context = {
    getHandler: () => handler,
    getClass: () => Ctl,
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as any;
  return { guard: new RateLimitGuard(reflector), context, res };
}

beforeEach(() => resetRateLimits());

describe('RateLimitGuard', () => {
  const opts: RateLimitOptions = { limit: 3, windowMs: 60_000, by: 'ip' };

  it('allows up to the limit, then answers 429 with Retry-After', () => {
    const { guard, context, res } = ctx(opts, { ip: '1.2.3.4' });
    for (let i = 0; i < 3; i++) expect(guard.canActivate(context)).toBe(true);
    try {
      guard.canActivate(context);
      fail('expected 429');
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(429);
    }
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('counts each IP separately', () => {
    const a = ctx(opts, { ip: '1.1.1.1' });
    const b = ctx(opts, { ip: '2.2.2.2' });
    for (let i = 0; i < 3; i++) a.guard.canActivate(a.context);
    expect(b.guard.canActivate(b.context)).toBe(true);
  });

  it('limits by user id when asked', () => {
    const userOpts: RateLimitOptions = { limit: 1, windowMs: 60_000, by: 'user' };
    const sameUserOtherIp = ctx(userOpts, { ip: '9.9.9.9', user: { id: 'u1' } });
    const first = ctx(userOpts, { ip: '8.8.8.8', user: { id: 'u1' } });
    first.guard.canActivate(first.context);
    expect(() => sameUserOtherIp.guard.canActivate(sameUserOtherIp.context)).toThrow(HttpException);
  });

  it('does nothing on routes without a limit', () => {
    const { guard, context } = ctx(undefined, { ip: '1.2.3.4' });
    for (let i = 0; i < 100; i++) expect(guard.canActivate(context)).toBe(true);
  });
});
