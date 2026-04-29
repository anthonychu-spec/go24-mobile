import type { BookingStatus } from '../entities/booking.entity';

const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending:         ['confirmed', 'failed', 'waitlist', 'pending_verify'],
  confirmed:       ['cancelled', 'attended', 'no_show'],
  waitlist:        ['confirmed', 'cancelled'],
  pending_verify:  ['confirmed', 'failed'],
  failed:          [],
  cancelled:       [],
  attended:        [],
  no_show:         [],
};

export function assertValidTransition(from: BookingStatus, to: BookingStatus): void {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new InvalidTransitionError(from, to);
  }
}

export class InvalidTransitionError extends Error {
  constructor(from: BookingStatus, to: BookingStatus) {
    super(`Invalid booking state transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}
