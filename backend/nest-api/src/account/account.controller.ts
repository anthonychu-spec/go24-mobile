import {
  ArgumentsHost, Body, Catch, Controller, ExceptionFilter, Get, HttpCode, HttpException, Logger,
  Post, Query, Req, Res, UseFilters, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeController, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedUser } from '../auth/jwt.strategy';
import { AuthService } from '../auth/auth.service';
import { RateLimit } from '../common/rate-limit';
import { AppError } from '../pgm-adapter/error-normalize';
import { BrandId, isBrandId } from '../brand/brand.constants';
import { AccountDeletionService } from './account-deletion.service';
import { MESSAGES, renderCode, renderDone, renderProblem, renderStart } from './account-deletion.page';

/** In-app deletion: the signed-in member deletes their own account. */
@ApiTags('account')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('me/account')
export class AccountController {
  constructor(private readonly deletion: AccountDeletionService) {}

  @ApiOperation({ summary: 'Delete my app account in every brand app (PGM membership is not touched)' })
  @RateLimit({ limit: 5, windowMs: 60 * 60_000, by: 'user' })
  @Post('deletion')
  @HttpCode(200)
  async delete(@Req() req: Request) {
    const user = req.user as AuthedUser;
    await this.deletion.deleteUser(user.id);
    return { status: 'deleted' };
  }
}

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

function sendHtml(res: Response, status: number, html: string): void {
  res.status(status).set(SECURITY_HEADERS).send(html);
}

/** Brand from the form or query string, for the app name on the page; unknown → none. */
function pageBrand(source: unknown): BrandId | null {
  const v = (source as { brand?: unknown } | undefined)?.brand;
  return isBrandId(v) ? v : null;
}

function field(body: unknown, name: string): string {
  const v = (body as Record<string, unknown> | undefined)?.[name];
  return typeof v === 'string' ? v.trim() : '';
}

/** Rate limits and anything unexpected come back as a page, not JSON. */
@Catch()
export class DeletionPageFilter implements ExceptionFilter {
  private readonly logger = new Logger('AccountDeletionPage');

  catch(err: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const status = err instanceof HttpException ? err.getStatus() : 500;
    if (status >= 500) this.logger.error('account deletion page failed', err as Error);
    const message = status === 429 ? MESSAGES.RATE_LIMITED : MESSAGES.TRY_LATER;
    // RateLimitGuard has already set Retry-After on a 429
    sendHtml(http.getResponse<Response>(), status, renderProblem(pageBrand(req.body ?? req.query), message));
  }
}

/**
 * Public deletion page (works after the app is uninstalled):
 * email → PGM one-time code (same as sign-in) → tick the box → deleted.
 */
@ApiExcludeController()
@UseFilters(DeletionPageFilter)
@Controller('account-deletion')
export class AccountDeletionPageController {
  constructor(
    private readonly auth: AuthService,
    private readonly deletion: AccountDeletionService,
  ) {}

  @RateLimit({ limit: 30, windowMs: 60_000, by: 'ip' })
  @Get()
  start(@Query() query: unknown, @Res() res: Response): void {
    sendHtml(res, 200, renderStart(pageBrand(query)));
  }

  @RateLimit({ limit: 5, windowMs: 10 * 60_000, by: 'ip' })
  @Post('code')
  async sendCode(@Body() body: unknown, @Res() res: Response): Promise<void> {
    const brand = pageBrand(body);
    const email = field(body, 'email');
    if (!email || email.length > 150 || !email.includes('@')) {
      return sendHtml(res, 400, renderStart(brand, MESSAGES.INVALID_EMAIL));
    }
    try {
      const { memberIdToken } = await this.auth.requestOtp(email);
      return sendHtml(res, 200, renderCode(brand, memberIdToken));
    } catch (err) {
      const code = err instanceof AppError ? err.code : null;
      // Unknown email: same page as a real one, with a token that can never verify,
      // so the page doesn't tell who is a member
      if (code === 'NOT_FOUND') return sendHtml(res, 200, renderCode(brand, ''));
      if (code === 'AMBIGUOUS_ACCOUNT') return sendHtml(res, 409, renderStart(brand, MESSAGES.AMBIGUOUS_ACCOUNT));
      throw err;
    }
  }

  @RateLimit({ limit: 10, windowMs: 10 * 60_000, by: 'ip' })
  @Post('confirm')
  async confirm(@Body() body: unknown, @Res() res: Response): Promise<void> {
    const brand = pageBrand(body);
    const token = field(body, 'memberIdToken');
    const code = field(body, 'code');
    if (field(body, 'confirm') !== 'yes') {
      return sendHtml(res, 400, renderCode(brand, token, MESSAGES.NOT_CONFIRMED));
    }
    if (!token || !code) return sendHtml(res, 400, renderCode(brand, token, MESSAGES.INVALID_OTP));

    let memberId: number;
    try {
      memberId = await this.auth.verifyMemberCode(token, code);
    } catch (err) {
      const appCode = err instanceof AppError ? err.code : null;
      if (appCode === 'INVALID_OTP') return sendHtml(res, 400, renderCode(brand, token, MESSAGES.INVALID_OTP));
      if (appCode === 'OTP_EXPIRED') return sendHtml(res, 410, renderStart(brand, MESSAGES.OTP_EXPIRED));
      throw err;
    }
    const { deleted } = await this.deletion.deleteByPgmMemberId(memberId);
    sendHtml(res, 200, renderDone(brand, deleted));
  }
}
