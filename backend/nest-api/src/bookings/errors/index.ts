import { ConflictException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';

export class BookingFullError extends ConflictException {
  constructor() { super({ code: 'BOOKING_FULL', message: '呢堂滿晒，可加入候補' }); }
}

export class DuplicateBookingError extends ConflictException {
  constructor() { super({ code: 'DUPLICATE_BOOKING', message: '你已 book 咗呢堂' }); }
}

export class ClassNotFoundError extends NotFoundException {
  constructor() { super({ code: 'CLASS_NOT_FOUND', message: '呢堂 temporarily 唔見' }); }
}

export class UpstreamAuthError extends HttpException {
  constructor() { super({ code: 'UPSTREAM_AUTH', message: 'PGM 認證過期' }, HttpStatus.BAD_GATEWAY); }
}

export class TempFailError extends HttpException {
  constructor() { super({ code: 'TEMP_FAIL', message: '暫時未能處理，請再試' }, HttpStatus.SERVICE_UNAVAILABLE); }
}

export class UpstreamError extends HttpException {
  constructor() { super({ code: 'UPSTREAM_ERROR', message: '系統忙，請稍後' }, HttpStatus.BAD_GATEWAY); }
}

export class UpstreamDownError extends HttpException {
  constructor() { super({ code: 'UPSTREAM_DOWN', message: '系統維護中' }, HttpStatus.SERVICE_UNAVAILABLE); }
}

export class InProgressError extends HttpException {
  constructor() { super({ code: 'IN_PROGRESS', message: '同一請求進行中，請稍後再試' }, HttpStatus.CONFLICT); }
}

export class ExternalServiceError extends HttpException {
  constructor(msg: string) { super({ code: 'EXTERNAL_ERROR', message: msg }, HttpStatus.BAD_GATEWAY); }
}

export function mapPgmError(err: unknown): string {
  if (err instanceof HttpException) {
    const body = err.getResponse() as { code?: string };
    return body?.code ?? 'UPSTREAM_ERROR';
  }
  return 'UPSTREAM_ERROR';
}

export function isTempFail(code: string): boolean {
  return ['TEMP_FAIL', 'UPSTREAM_DOWN', 'UPSTREAM_ERROR', 'UPSTREAM_AUTH'].includes(code);
}
