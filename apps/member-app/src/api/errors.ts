import { isAxiosError } from 'axios';
import { t } from '../i18n';

/** True for the brand feature guard's answer: a bare 404 with no `code` (a real missing record has one). */
export function isFeatureOff(err: unknown): boolean {
  if (!isAxiosError(err) || err.response?.status !== 404) return false;
  return !(err.response.data as { code?: unknown } | undefined)?.code;
}

/**
 * Backend error `code` (body is `{ code, message }`), or a client-side one:
 * NETWORK (no response: offline, timeout, DNS) / FEATURE_OFF / RATE_LIMITED / UNKNOWN.
 */
export function apiErrorCode(err: unknown): string {
  if (!isAxiosError(err)) return 'UNKNOWN';
  if (!err.response) return 'NETWORK';
  const code = (err.response.data as { code?: unknown } | undefined)?.code;
  if (typeof code === 'string' && code) return code;
  if (isFeatureOff(err)) return 'FEATURE_OFF';
  if (err.response.status === 429) return 'RATE_LIMITED';
  return 'UNKNOWN';
}

/** User-facing message for an API error code (also the `error` of a BookResult). */
export function messageForCode(code: string | null | undefined): string {
  switch (code) {
    case 'INVALID_CREDENTIALS':    return t.errors.invalidCredentials;
    case 'AMBIGUOUS_ACCOUNT':      return t.errors.ambiguousAccount;
    case 'MEMBER_INACTIVE':        return t.errors.memberInactive;
    case 'ACCOUNT_LOCKED':         return t.errors.accountLocked;
    case 'RATE_LIMITED':           return t.errors.rateLimited;
    case 'NETWORK':                return t.errors.networkError;
    case 'BOOKING_FULL':           return t.errors.bookingFull;
    case 'DUPLICATE_BOOKING':      return t.errors.duplicateBooking;
    case 'DAILY_LIMIT':            return t.errors.dailyLimit;
    case 'OUTSIDE_BOOKING_WINDOW': return t.errors.outsideWindow;
    case 'FEATURE_OFF':            return t.errors.featureOff;
    case 'CLASS_NOT_FOUND':        return t.errors.classNotFound;
    case 'CANCEL_TOO_LATE':        return t.errors.cancelTooLate;
    case 'IN_PROGRESS':
    case 'TEMP_FAIL':
    case 'UPSTREAM_ERROR':
    case 'UPSTREAM_DOWN':
    case 'UPSTREAM_AUTH':
    case 'EXTERNAL_ERROR':         return t.errors.tryAgainShortly;
    default:                       return t.errors.unknown;
  }
}

/** User-facing message for an API error. */
export function apiErrorMessage(err: unknown): string {
  return messageForCode(apiErrorCode(err));
}
