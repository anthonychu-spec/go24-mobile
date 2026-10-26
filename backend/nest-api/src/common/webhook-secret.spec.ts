import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { assertWebhookSecret } from './webhook-secret';

describe('assertWebhookSecret', () => {
  it('accepts the configured secret', () => {
    expect(() => assertWebhookSecret('test', 's3cret-value', 's3cret-value')).not.toThrow();
  });

  it('rejects a wrong or missing header with 401', () => {
    expect(() => assertWebhookSecret('test', 's3cret-value', 'nope')).toThrow(UnauthorizedException);
    expect(() => assertWebhookSecret('test', 's3cret-value', undefined)).toThrow(UnauthorizedException);
    expect(() => assertWebhookSecret('test', 's3cret-value', '')).toThrow(UnauthorizedException);
  });

  it('refuses every call when no secret is configured', () => {
    expect(() => assertWebhookSecret('test', undefined, 'anything')).toThrow(InternalServerErrorException);
    expect(() => assertWebhookSecret('test', '', '')).toThrow(InternalServerErrorException);
  });
});
