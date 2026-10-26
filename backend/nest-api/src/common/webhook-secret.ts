import { InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

const logger = new Logger('WebhookSecret');

/**
 * Guards an unauthenticated webhook with a shared secret header.
 * - Secret not configured → refuse (500): an unset secret must never mean "accept anything".
 * - Wrong or missing header → 401.
 * Compared as SHA-256 digests with timingSafeEqual so length and content don't leak via timing.
 */
export function assertWebhookSecret(name: string, expected: string | undefined, provided: string | undefined): void {
  if (!expected) {
    logger.error(`${name} webhook called but its secret is not configured — rejecting`);
    throw new InternalServerErrorException('webhook not configured');
  }
  const a = createHash('sha256').update(expected).digest();
  const b = createHash('sha256').update(provided ?? '').digest();
  if (!provided || !timingSafeEqual(a, b)) {
    logger.warn(`${name} webhook rejected: bad secret`);
    throw new UnauthorizedException('invalid webhook secret');
  }
}
