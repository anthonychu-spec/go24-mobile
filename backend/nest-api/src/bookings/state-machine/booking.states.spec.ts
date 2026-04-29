import { assertValidTransition, InvalidTransitionError } from './booking.states';
import type { BookingStatus } from '../entities/booking.entity';

describe('assertValidTransition', () => {
  const valid: [BookingStatus, BookingStatus][] = [
    ['pending', 'confirmed'],
    ['pending', 'failed'],
    ['pending', 'waitlist'],
    ['pending', 'pending_verify'],
    ['confirmed', 'cancelled'],
    ['confirmed', 'attended'],
    ['confirmed', 'no_show'],
    ['waitlist', 'confirmed'],
    ['waitlist', 'cancelled'],
    ['pending_verify', 'confirmed'],
    ['pending_verify', 'failed'],
  ];

  const invalid: [BookingStatus, BookingStatus][] = [
    ['confirmed', 'pending'],
    ['confirmed', 'pending_verify'],
    ['failed', 'confirmed'],
    ['failed', 'pending'],
    ['cancelled', 'confirmed'],
    ['attended', 'cancelled'],
    ['no_show', 'confirmed'],
    ['pending_verify', 'waitlist'],
  ];

  it.each(valid)('allows %s → %s', (from, to) => {
    expect(() => assertValidTransition(from, to)).not.toThrow();
  });

  it.each(invalid)('rejects %s → %s', (from, to) => {
    expect(() => assertValidTransition(from, to)).toThrow(InvalidTransitionError);
  });

  it('error message names both states', () => {
    try {
      assertValidTransition('failed', 'confirmed');
      fail('should have thrown');
    } catch (e) {
      expect((e as Error).message).toContain('failed');
      expect((e as Error).message).toContain('confirmed');
    }
  });
});
