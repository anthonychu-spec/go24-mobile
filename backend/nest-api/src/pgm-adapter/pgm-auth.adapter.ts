import { Injectable } from '@nestjs/common';
import { PgmClient } from './pgm.client';
import { AppError, normalizePgmError } from './error-normalize';

export type PgmCodeDestination = 'Email' | 'Sms';

export interface VerifyMemberCredentialsResult {
  memberId: number;
  status: string; // 'Active' | 'Inactive' | 'Frozen' | ...
}

export interface VerifyOneTimeCodeResult {
  codeMatches: boolean;
  memberId: number;
}

/**
 * Adapter wrapping PGM /v2.2/MemberAuth/* endpoints.
 * Stage 1 uses VerifyMemberCredentials (Option A) and SendOneTimeCode + VerifyOneTimeCode (Option B).
 */
@Injectable()
export class PgmAuthAdapter {
  constructor(private readonly client: PgmClient) {}

  async verifyMemberCredentials(email: string, password: string): Promise<VerifyMemberCredentialsResult> {
    try {
      return await this.client.post<VerifyMemberCredentialsResult>(
        '/MemberAuth/VerifyMemberCredentials',
        { email, password },
      );
    } catch (err) {
      throw normalizePgmError(err);
    }
  }

  async sendOneTimeCode(memberId: number, codeDestination: PgmCodeDestination = 'Email'): Promise<void> {
    try {
      await this.client.post<unknown>(
        '/MemberAuth/SendOneTimeCode',
        { memberId, codeDestination },
      );
    } catch (err) {
      throw normalizePgmError(err);
    }
  }

  async verifyOneTimeCode(memberId: number, code: string): Promise<VerifyOneTimeCodeResult> {
    try {
      return await this.client.post<VerifyOneTimeCodeResult>(
        '/MemberAuth/VerifyOneTimeCode',
        { memberId, code },
      );
    } catch (err) {
      throw normalizePgmError(err);
    }
  }

  /**
   * Find memberId from email via OData query.
   * Used for /auth/request-otp where user enters email but we need memberId.
   *
   * SECURITY: input is validated as RFC-5321-ish email before interpolation
   * (defense-in-depth on top of DTO @IsEmail). Reject control chars and any
   * char that could break out of the OData string literal.
   */
  async lookupMemberIdByEmail(email: string): Promise<number | null> {
    if (!isSafeEmailForOData(email)) {
      throw new AppError('NOT_FOUND', 'invalid email');
    }
    try {
      const escaped = email.replace(/'/g, "''");
      const res = await this.client.get<{ value?: Array<{ Id: number }> }>(
        '/odata/Members',
        { $filter: `Email eq '${escaped}'`, $select: 'Id', $top: 1 },
      );
      return res.value?.[0]?.Id ?? null;
    } catch (err) {
      throw normalizePgmError(err);
    }
  }

  /** Fetch member Number (user_number) by PGM member Id */
  async getMemberNumber(memberId: number): Promise<string | null> {
    try {
      const res = await this.client.get<{ value?: Array<{ Id: number; Number: string }> }>(
        '/odata/Members',
        { $filter: `Id eq ${memberId}`, $select: 'Id,Number', $top: 1 },
      );
      return res.value?.[0]?.Number ?? null;
    } catch {
      return null;
    }
  }
}

/** Strict email check before interpolation into OData filter. */
function isSafeEmailForOData(email: string): boolean {
  if (typeof email !== 'string') return false;
  if (email.length === 0 || email.length > 254) return false;
  // No control chars, no whitespace, no backslash, no embedded quote-runs.
  // Allow the standard email-safe charset only.
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email);
}
