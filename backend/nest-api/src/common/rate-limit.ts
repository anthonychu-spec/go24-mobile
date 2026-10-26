import {
  applyDecorators, CanActivate, ExecutionContext, HttpException, HttpStatus,
  Injectable, SetMetadata, UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

export interface RateLimitOptions {
  limit: number;      // requests allowed per window
  windowMs: number;
  by: 'ip' | 'user';  // 'user' needs JwtAuthGuard to run first (controller-level guards do)
}

const RATE_LIMIT_KEY = 'rateLimit';

// Fixed-window counters, in memory. v1 runs a single API instance; move to Redis
// before running more than one.
const hits = new Map<string, { count: number; resetAt: number }>();
const MAX_KEYS = 50_000;

/** Per-route request limit, e.g. @RateLimit({ limit: 10, windowMs: 60_000, by: 'ip' }). */
export const RateLimit = (opts: RateLimitOptions) =>
  applyDecorators(SetMetadata(RATE_LIMIT_KEY, opts), UseGuards(RateLimitGuard));

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const opts = this.reflector.get<RateLimitOptions | undefined>(RATE_LIMIT_KEY, ctx.getHandler());
    if (!opts) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: { id?: string } }>();
    const who = opts.by === 'user' && req.user?.id ? `u:${req.user.id}` : `ip:${req.ip}`;
    const key = `${ctx.getClass().name}.${ctx.getHandler().name}|${who}`;

    const now = Date.now();
    if (hits.size >= MAX_KEYS) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      if (hits.size >= MAX_KEYS) hits.clear();
    }

    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + opts.windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    if (entry.count > opts.limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      ctx.switchToHttp().getResponse<Response>().setHeader('Retry-After', String(retryAfter));
      throw new HttpException({ code: 'RATE_LIMITED', message: 'Too many requests, try again shortly' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}

/** Test helper — clears all counters. */
export function resetRateLimits(): void {
  hits.clear();
}
