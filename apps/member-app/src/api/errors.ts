import { isAxiosError } from 'axios';
import { t } from '../i18n';

/**
 * Backend error `code` (body is `{ code, message }`), or a client-side one:
 * NETWORK (no response: offline, timeout, DNS) / DAILY_LIMIT / OUTSIDE_WINDOW / UNKNOWN.
 */
export function apiErrorCode(err: unknown): string {
  if (!isAxiosError(err)) return 'UNKNOWN';
  if (!err.response) return 'NETWORK';
  const code = (err.response.data as { code?: unknown } | undefined)?.code;
  if (typeof code === 'string' && code) return code;
  if (err.response.status === 429) return 'RATE_LIMITED';
  // POST /bookings rules come back as plain 400 messages (no code yet)
  const message = String((err.response.data as { message?: unknown } | undefined)?.message ?? '');
  if (/daily limit/i.test(message)) return 'DAILY_LIMIT';
  if (/booking window/i.test(message)) return 'OUTSIDE_WINDOW';
  return 'UNKNOWN';
}

/** User-facing message for an API error code (also the `error` of a BookResult). */
export function messageForCode(code: string | null | undefined): string {
  switch (code) {
    case 'INVALID_CREDENTIALS': return t.errors.invalidCredentials;
    case 'AMBIGUOUS_ACCOUNT':   return t.errors.ambiguousAccount;
    case 'MEMBER_INACTIVE':     return t.errors.memberInactive;
    case 'ACCOUNT_LOCKED':      return t.errors.accountLocked;
    case 'RATE_LIMITED':        return t.errors.rateLimited;
    case 'NETWORK':             return t.errors.networkError;
    case 'BOOKING_FULL':        return t.errors.bookingFull;
    case 'DUPLICATE_BOOKING':   return t.errors.duplicateBooking;
    case 'DAILY_LIMIT':         return t.errors.dailyLimit;
    case 'OUTSIDE_WINDOW':      return t.errors.outsideWindow;
    case 'CLASS_NOT_FOUND':     return t.errors.classNotFound;
    case 'CANCEL_TOO_LATE':     return t.errors.cancelTooLate;
    case 'IN_PROGRESS':
    case 'TEMP_FAIL':
    case 'UPSTREAM_ERROR':
    case 'UPSTREAM_DOWN':       return t.errors.tryAgainShortly;
    default:                    return t.errors.unknown;
  }
}

/** User-facing message for an API error. */
export function apiErrorMessage(err: unknown): string {
  return messageForCode(apiErrorCode(err));
}
