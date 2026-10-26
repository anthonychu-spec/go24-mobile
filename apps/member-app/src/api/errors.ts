import { isAxiosError } from 'axios';
import { t } from '../i18n';

/**
 * Backend error `code` (body is `{ code, message }`), or a client-side one:
 * NETWORK (no response: offline, timeout, DNS) / UNKNOWN.
 */
export function apiErrorCode(err: unknown): string {
  if (!isAxiosError(err)) return 'UNKNOWN';
  if (!err.response) return 'NETWORK';
  const code = (err.response.data as { code?: unknown } | undefined)?.code;
  if (typeof code === 'string' && code) return code;
  if (err.response.status === 429) return 'RATE_LIMITED';
  return 'UNKNOWN';
}

/** User-facing message for an API error. */
export function apiErrorMessage(err: unknown): string {
  switch (apiErrorCode(err)) {
    case 'INVALID_CREDENTIALS': return t.errors.invalidCredentials;
    case 'AMBIGUOUS_ACCOUNT':   return t.errors.ambiguousAccount;
    case 'MEMBER_INACTIVE':     return t.errors.memberInactive;
    case 'ACCOUNT_LOCKED':      return t.errors.accountLocked;
    case 'RATE_LIMITED':        return t.errors.rateLimited;
    case 'NETWORK':             return t.errors.networkError;
    default:                    return t.errors.unknown;
  }
}
