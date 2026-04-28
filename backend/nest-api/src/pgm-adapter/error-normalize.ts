import { HttpException, HttpStatus } from '@nestjs/common';
import { AxiosError } from 'axios';

export type AppErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'MEMBER_INACTIVE'
  | 'INVALID_OTP'
  | 'OTP_EXPIRED'
  | 'BOOKING_FULL'
  | 'DUPLICATE_BOOKING'
  | 'CLASS_NOT_FOUND'
  | 'CANCEL_TOO_LATE'
  | 'UPSTREAM_AUTH'
  | 'UPSTREAM_ERROR'
  | 'UPSTREAM_DOWN'
  | 'TEMP_FAIL'
  | 'NOT_FOUND'
  | 'UNKNOWN';

const httpStatus: Record<AppErrorCode, HttpStatus> = {
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  MEMBER_INACTIVE: HttpStatus.FORBIDDEN,
  INVALID_OTP: HttpStatus.UNAUTHORIZED,
  OTP_EXPIRED: HttpStatus.GONE,
  BOOKING_FULL: HttpStatus.CONFLICT,
  DUPLICATE_BOOKING: HttpStatus.CONFLICT,
  CLASS_NOT_FOUND: HttpStatus.NOT_FOUND,
  CANCEL_TOO_LATE: HttpStatus.CONFLICT,
  UPSTREAM_AUTH: HttpStatus.UNAUTHORIZED,
  UPSTREAM_ERROR: HttpStatus.BAD_GATEWAY,
  UPSTREAM_DOWN: HttpStatus.SERVICE_UNAVAILABLE,
  TEMP_FAIL: HttpStatus.SERVICE_UNAVAILABLE,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  UNKNOWN: HttpStatus.INTERNAL_SERVER_ERROR,
};

export class AppError extends HttpException {
  constructor(public readonly code: AppErrorCode, message?: string) {
    super({ code, message: message ?? code }, httpStatus[code]);
  }
}

/**
 * Translate a raw axios/PGM error into our internal AppError.
 * Priority: PGM error code (if structured) → HTTP status → message regex.
 *
 * Mobile clients should NEVER see raw English PGM messages.
 */
export function normalizePgmError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (axios_isAxiosError(err)) {
    // Network-class errors (timeout, DNS, ECONNREFUSED) → TEMP_FAIL
    // These have no `err.response` so must be caught BEFORE status checks
    if (!err.response || err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      return new AppError('TEMP_FAIL', err.message);
    }

    const status = err.response.status;
    const data = (err.response.data ?? {}) as Record<string, unknown>;
    const code = String(data.errorCode ?? data.code ?? '');
    const msg = String(data.message ?? data.error ?? err.message ?? '');

    if (code) {
      if (/full|capacity/i.test(code)) return new AppError('BOOKING_FULL');
      if (/duplicate/i.test(code)) return new AppError('DUPLICATE_BOOKING');
      if (/credential|invalid.*pass/i.test(code)) return new AppError('INVALID_CREDENTIALS');
      if (/member.*inactive|frozen|suspended/i.test(code)) return new AppError('MEMBER_INACTIVE');
    }

    if (status === 401) return new AppError('INVALID_CREDENTIALS', msg);
    if (status === 403) return new AppError('MEMBER_INACTIVE', msg);
    if (status === 404) return new AppError('NOT_FOUND', msg);
    if (status === 408 || status === 504) return new AppError('TEMP_FAIL', msg);
    if (status >= 500) return new AppError('UPSTREAM_ERROR', msg);

    if (/full|capacity/i.test(msg)) return new AppError('BOOKING_FULL', msg);
    if (/already.*booked|duplicate/i.test(msg)) return new AppError('DUPLICATE_BOOKING', msg);
    if (/invalid.*credential|wrong.*password/i.test(msg)) return new AppError('INVALID_CREDENTIALS', msg);
    if (/timeout/i.test(msg)) return new AppError('TEMP_FAIL', msg);
  }

  return new AppError('UNKNOWN', err instanceof Error ? err.message : String(err));
}

function axios_isAxiosError(err: unknown): err is AxiosError {
  return typeof err === 'object' && err !== null && (err as AxiosError).isAxiosError === true;
}
