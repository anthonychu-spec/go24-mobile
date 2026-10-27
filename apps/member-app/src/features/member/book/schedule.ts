import type { GymClass, MyBooking } from '../../../api/member';
import { messageForCode } from '../../../api/errors';
import { dayParts, hkDateKey, hkTime, isFuture, minutesBetween } from '../../../lib/hkTime';
import { programmeFor } from '../programmes';

// Pure helpers for the Book tab: availability, filters, copy for booking results.

/** Today + 7 days: the backend's 168-hour booking window */
export const SCHEDULE_DAYS = 8;
const WINDOW_MS = 168 * 3600_000;

export const spacesLeft = (c: GymClass) => Math.max(0, c.maxParticipants - c.participantsCount);
export const isFull = (c: GymClass) => spacesLeft(c) === 0;
export const hasWaitlist = (c: GymClass) => c.standbyListLimit > 0;
/** Shown in the schedule: not started, not cancelled */
export const isUpcoming = (c: GymClass) => !c.isCancelled && isFuture(c.startTime);

export function matchesPillar(c: GymClass, pillar: string | null) {
  return !pillar || programmeFor(c.name).pillar.toUpperCase().includes(pillar.toUpperCase());
}

/** Date and time parts for a class, Hong Kong time */
export function classWhen(c: GymClass) {
  return { ...dayParts(hkDateKey(c.startTime)), time: hkTime(c.startTime), minutes: minutesBetween(c.startTime, c.endTime) };
}

/** 'Booking opens today at 19:15' while the class is beyond the 168-hour window, else null */
export function opensLabel(c: GymClass): string | null {
  const at = new Date(c.startTime).getTime() - WINDOW_MS;
  if (at <= Date.now()) return null;
  const key = hkDateKey(at);
  return `Booking opens ${key === hkDateKey() ? 'today' : dayParts(key).long} at ${hkTime(at)}`;
}

export type Tone = 'normal' | 'low' | 'ok' | 'warn' | 'muted';

export interface Availability {
  label: string;
  tone: Tone;
  /** Row button: null = shown disabled */
  action: 'book' | 'waitlist' | 'view' | null;
  button: string;
}

/** Availability line and action for a class, given the member's live booking for it */
export function availability(c: GymClass, booking?: MyBooking): Availability {
  if (booking) {
    if (booking.status === 'waitlist') return { label: 'You’re on the waitlist', tone: 'warn', action: 'view', button: 'View' };
    if (booking.status === 'pending' || booking.status === 'pending_verify') {
      return { label: 'Confirming your place', tone: 'muted', action: 'view', button: 'View' };
    }
    return { label: 'You’re booked in', tone: 'ok', action: 'view', button: 'View' };
  }
  const opens = opensLabel(c);
  if (opens) return { label: opens, tone: 'muted', action: null, button: 'Book' };
  const left = spacesLeft(c);
  if (left > 0) {
    return { label: `${left} ${left === 1 ? 'space' : 'spaces'} available`, tone: left <= 2 ? 'low' : 'normal', action: 'book', button: 'Book' };
  }
  if (hasWaitlist(c)) return { label: 'Fully booked · waitlist open', tone: 'low', action: 'waitlist', button: 'Waitlist' };
  return { label: 'Fully booked', tone: 'low', action: null, button: 'Full' };
}

export const resultErrorMessage = messageForCode;
