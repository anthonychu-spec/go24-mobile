// Club times are Hong Kong time (UTC+8, no daylight saving), whatever the phone's time zone.
// Done by hand so it doesn't depend on Intl time-zone support in Hermes.

const HK_OFFSET_MS = 8 * 3600_000;
export const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Shifted Date whose UTC fields read as Hong Kong wall-clock time */
function hkDate(t: string | number | Date) {
  return new Date(new Date(t).getTime() + HK_OFFSET_MS);
}

/** 'YYYY-MM-DD' in Hong Kong */
export function hkDateKey(t: string | number | Date = Date.now()): string {
  const d = hkDate(t);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 'HH:MM' in Hong Kong */
export function hkTime(t: string | number | Date): string {
  const d = hkDate(t);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Day parts for a 'YYYY-MM-DD' key */
export function dayParts(key: string) {
  const d = new Date(`${key}T00:00:00Z`);
  return {
    wd: WEEKDAYS[d.getUTCDay()],
    day: d.getUTCDate(),
    month: MONTHS[d.getUTCMonth()],
    /** 'Monday 26 October' */
    long: `${WEEKDAYS_LONG[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]}`,
  };
}

export function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** ISO instant for a Hong Kong date + 'HH:MM' */
export function hkInstant(key: string, time: string): string {
  return new Date(`${key}T${time}:00+08:00`).toISOString();
}

export function minutesBetween(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

export const isFuture = (t: string | null | undefined) => !!t && new Date(t).getTime() > Date.now();
