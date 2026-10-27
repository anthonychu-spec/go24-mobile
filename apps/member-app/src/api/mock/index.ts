import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { brand } from '../../brand';
import { addDays, hkDateKey, hkInstant } from '../../lib/hkTime';
import type { Feature } from '../../../brands/types';
import type { ActivityItem, BookingStatus, GymClass, MyBooking, Settings } from '../member';
import { VISIT_GOAL_MAX, VISIT_GOAL_MIN } from '../rules';

// In-memory stand-in for the API, for working on screens before the server exists (gate G5).
// On with EXPO_PUBLIC_API_MOCK=1. Any email + a 6+ character password signs in. State resets on reload.

export const MOCK_API = process.env.EXPO_PUBLIC_API_MOCK === '1';

const CLUB = { id: 45, name: 'THE LAB Central' };
const PROGRAMMES = ['THE FORGE', 'THE PULSE', 'THE RANGE', 'THE ASCENT', 'THE HYBRID', 'THE TRIBE'];
const COACHES = ['Alex', 'Jamie', 'Chris', 'Taylor'];
const WEEKDAY_TIMES = ['06:30', '07:45', '09:30', '12:15', '17:30', '19:15'];
const WEEKEND_TIMES = ['08:00', '09:30', '11:00', '12:30', '14:00', '16:00'];

const user = { id: 'mock-user', email: 'member@example.com', role: 'member', memberCode: '000128' };
const member = { firstName: 'Jordan', lastName: 'Lee' };

function buildClasses(): Map<number, GymClass> {
  const out = new Map<number, GymClass>();
  const today = hkDateKey();
  for (let day = 0; day < 14; day++) {
    const key = addDays(today, day);
    const weekend = [0, 6].includes(new Date(`${key}T00:00:00Z`).getUTCDay());
    (weekend ? WEEKEND_TIMES : WEEKDAY_TIMES).forEach((time, slot) => {
      const id = 9000 + day * 10 + slot;
      const name = PROGRAMMES[(slot + day) % PROGRAMMES.length];
      const start = hkInstant(key, time);
      const max = 12;
      // Slot 3 is full (waitlist open), slot 1 has 2 places left
      const taken = slot === 3 ? max : slot === 1 ? max - 2 : 4 + slot;
      out.set(id, {
        id, name, startTime: start,
        endTime: new Date(new Date(start).getTime() + (name === 'THE HYBRID' ? 90 : 60) * 60000).toISOString(),
        clubId: CLUB.id, clubName: CLUB.name, instructorName: COACHES[slot % COACHES.length],
        maxParticipants: max, participantsCount: taken, standbyListLimit: 5,
        isWaitlist: false, isCancelled: false,
      });
    });
  }
  return out;
}

const classes = buildClasses();
let bookings: MyBooking[] = [];
const DEFAULT_SETTINGS: Settings = { reminderMinutes: 60, autoWaitlistCancel: false, visitGoal: null };
let settings: Settings = { ...DEFAULT_SETTINGS };
let seq = 1;

function addBooking(cls: GymClass, status: BookingStatus, waitlistPosition: number | null = null): MyBooking {
  const b: MyBooking = {
    id: `mock-booking-${seq++}`, classId: cls.id, clubId: cls.clubId, status, waitlistPosition,
    className: cls.name, clubName: cls.clubName, startTime: cls.startTime, endTime: cls.endTime,
    instructorName: cls.instructorName,
  };
  bookings.push(b);
  return b;
}

// One booking tomorrow so Home and Passport have something to show
const tomorrow = [...classes.values()].find((c) => hkDateKey(c.startTime) === addDays(hkDateKey(), 1));
if (tomorrow) {
  addBooking(tomorrow, 'confirmed');
  tomorrow.participantsCount += 1;
}

// Past classes and visits for Passport history
const history: ActivityItem[] = Array.from({ length: 9 }, (_, i) => {
  const key = addDays(hkDateKey(), -(i * 3 + 2));
  return {
    id: `mock-class-${i}`, type: 'class' as const, title: PROGRAMMES[i % PROGRAMMES.length],
    subtitle: COACHES[i % COACHES.length], at: hkInstant(key, i % 2 ? '07:45' : '18:30'), club: CLUB.name,
  };
});

const active = (b: MyBooking) => b.status === 'confirmed' || b.status === 'waitlist' || b.status === 'pending';
let deleted = false;

/** Monday (HK) of a 'YYYY-MM-DD' key, as a key */
const weekOf = (key: string) => addDays(key, -((new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7));

/** Same rule as backend passport.service weeksInARow: this week counts once visited, else start last week */
function weeksInARow(): number {
  const weeks = new Set(history.map((h) => weekOf(hkDateKey(h.at))));
  let week = weekOf(hkDateKey());
  if (!weeks.has(week)) week = addDays(week, -7);
  let run = 0;
  for (; weeks.has(week); week = addDays(week, -7)) run++;
  return run;
}

class MockError extends Error {
  constructor(readonly status: number, readonly body: object) { super(`mock ${status}`); }
}
/** AppError / coded HttpException body */
const fail = (status: number, code: string, message = code): never => { throw new MockError(status, { code, message }); };
/** Nest's plain exception bodies (no code) */
const plain = (status: number, message: string | string[], error: string): never => {
  throw new MockError(status, { statusCode: status, message, error });
};

type Handler = (m: RegExpMatchArray, body: any, config: InternalAxiosRequestConfig) => unknown;
/** public: no sign-in needed; feature: the brand feature guard (404 with no code when off) */
type Route = [string, RegExp, Handler, { public?: true; feature?: Feature }?];

const routes: Route[] = [
  ['POST', /^\/auth\/login$/, (_m, body) => {
    if (!body?.email || String(body.password ?? '').length < 6) fail(401, 'INVALID_CREDENTIALS');
    deleted = false; // signing in again makes a fresh app account
    return { accessToken: 'mock-access', refreshToken: 'mock-refresh', user: { ...user, email: body.email } };
  }, { public: true }],
  ['POST', /^\/auth\/refresh$/, () => {
    if (deleted) plain(401, 'account deleted', 'Unauthorized');
    return { accessToken: 'mock-access', refreshToken: 'mock-refresh' };
  }, { public: true }],
  ['POST', /^\/auth\/logout$/, () => null, { public: true }],
  ['GET', /^\/auth\/me$/, () => user],
  ['GET', /^\/app-config$/, () => ({
    brand: brand.id, name: brand.name, minAppVersion: null, maintenanceMessage: null, features: brand.features,
  }), { public: true }],
  ['POST', /^\/notifications\/device$/, () => ({ ok: true })],

  ['GET', /^\/booking\/classes\/week$/, (_m, _b, config) => {
    const days = Number(config.params?.days ?? 14);
    const last = addDays(hkDateKey(), days - 1);
    const out: Record<string, GymClass[]> = {};
    for (const c of classes.values()) {
      const key = hkDateKey(c.startTime);
      if (key > last) continue;
      (out[key] ??= []).push({ ...c });
    }
    return out;
  }, { feature: 'classes' }],
  ['GET', /^\/booking\/classes\/(\d+)$/, (m) => classes.get(Number(m[1])) ?? fail(404, 'CLASS_NOT_FOUND'), { feature: 'classes' }],

  ['GET', /^\/bookings$/, () => bookings.filter((b) => b.status !== 'failed').map((b) => ({ ...b })), { feature: 'classes' }],
  ['POST', /^\/bookings$/, (_m, body) => {
    const cls = classes.get(Number(body?.classId)) ?? fail(404, 'CLASS_NOT_FOUND');
    if (new Date(cls.startTime).getTime() > Date.now() + 168 * 3600_000) {
      fail(400, 'OUTSIDE_BOOKING_WINDOW', 'Class is outside the 168-hour booking window');
    }
    if (bookings.some((b) => b.classId === cls.id && active(b))) fail(409, 'DUPLICATE_BOOKING');
    const day = hkDateKey(cls.startTime);
    if (bookings.some((b) => active(b) && b.startTime && hkDateKey(b.startTime) === day)) {
      fail(400, 'DAILY_LIMIT', 'Daily limit reached — you can only book 1 class per day');
    }
    if (cls.participantsCount >= cls.maxParticipants) {
      if (!body?.acceptWaitlist || cls.standbyListLimit === 0) fail(409, 'BOOKING_FULL');
      const position = bookings.filter((b) => b.classId === cls.id && b.status === 'waitlist').length + 1;
      const b = addBooking(cls, 'waitlist', position);
      return { success: true, bookingId: b.id, status: 'waitlist' };
    }
    cls.participantsCount += 1;
    const b = addBooking(cls, 'confirmed');
    return { success: true, bookingId: b.id, status: 'confirmed' };
  }, { feature: 'classes' }],
  ['DELETE', /^\/bookings\/(.+)$/, (m) => {
    const b = bookings.find((x) => x.id === m[1] && active(x)) ?? plain(400, 'Booking not found', 'Bad Request');
    if (b.status === 'confirmed') {
      const cls = classes.get(b.classId);
      if (cls) cls.participantsCount -= 1;
    }
    b.status = 'cancelled';
    return null;
  }, { feature: 'classes' }],

  ['GET', /^\/me\/dashboard$/, () => ({
    user: { name: `${member.firstName} ${member.lastName}`, email: user.email, memberCode: user.memberCode },
    membership: { active: true, planName: 'Train + Recover', daysRemaining: 214, expiresAt: addDays(hkDateKey(), 214) },
    thisMonth: { visits: history.filter((h) => h.at.slice(0, 7) === new Date().toISOString().slice(0, 7)).length, classes: 0 },
    totalVisits: history.length,
  })],
  ['GET', /^\/me\/profile$/, () => ({
    hasMembership: true,
    member: {
      pgmId: 128, name: `${member.firstName} ${member.lastName}`, ...member,
      email: user.email, phone: '+852 5555 0128', memberCode: user.memberCode,
    },
  })],
  ['GET', /^\/me\/settings$/, () => settings],
  ['PATCH', /^\/me\/settings$/, (_m, body) => {
    const goal = body?.visitGoal;
    if (goal !== undefined && goal !== null && !(Number.isInteger(goal) && goal >= VISIT_GOAL_MIN && goal <= VISIT_GOAL_MAX)) {
      plain(400, [`visitGoal must be between ${VISIT_GOAL_MIN} and ${VISIT_GOAL_MAX}`], 'Bad Request');
    }
    return (settings = { ...settings, ...body });
  }],
  ['GET', /^\/me\/passport\/visits$/, () => {
    const month = hkDateKey().slice(0, 7);
    return {
      month,
      visitsThisMonth: history.filter((h) => hkDateKey(h.at).slice(0, 7) === month).length,
      weeksInARow: weeksInARow(),
      visitGoal: settings.visitGoal,
    };
  }],
  ['POST', /^\/me\/account\/deletion$/, () => {
    bookings = [];
    settings = { ...DEFAULT_SETTINGS };
    deleted = true;
    return { status: 'deleted' };
  }],
  ['GET', /^\/activity$/, () => ({
    summary: {
      classesTotal: history.length, checkinsTotal: history.length, streakDays: 3,
      thisMonth: { classes: history.length, pt: 0, checkins: history.length },
    },
    items: history,
  })],
  ['GET', /^\/checkin\/qr$/, () => {
    const expiresAt = new Date(Date.now() + 30_000).toISOString();
    return { payload: `${user.id}|128|${expiresAt}|mock`, userId: user.id, pgmId: 128, expiresAt };
  }, { feature: 'member_qr' }],
  ['POST', /^\/coaching\/enquiries$/, () => ({
    id: `mock-enquiry-${seq++}`, status: 'received',
    message: 'Enquiry received. No coach has contacted you yet — the team will get back to you.',
  }), { feature: 'coaching_enquiry' }],
  ['GET', /^\/coaching\/enquiries$/, () => [], { feature: 'coaching_enquiry' }],
];

export const mockAdapter: AxiosAdapter = async (config) => {
  await new Promise((r) => setTimeout(r, 250));
  const method = (config.method ?? 'get').toUpperCase();
  const url = (config.url ?? '').replace(config.baseURL ?? '', '').split('?')[0];
  const body = typeof config.data === 'string' && config.data ? JSON.parse(config.data) : config.data;
  const respond = (status: number, data: unknown) =>
    ({ data, status, statusText: String(status), headers: new AxiosHeaders(), config, request: {} });

  for (const [m, pattern, handler, opts] of routes) {
    const match = method === m ? url.match(pattern) : null;
    if (!match) continue;
    try {
      // Same order as the server: the global feature guard, then the JWT guard
      if (opts?.feature && !brand.features[opts.feature]) plain(404, 'Not Found', 'Not Found');
      if (!opts?.public && (deleted || !String(config.headers?.Authorization ?? '').startsWith('Bearer '))) {
        plain(401, 'Unauthorized', 'Unauthorized');
      }
      const data = handler(match, body, config);
      return respond(data == null ? 204 : 200, data ?? '');
    } catch (err) {
      if (!(err instanceof MockError)) throw err;
      const res = respond(err.status, err.body);
      throw new AxiosError(`Request failed with status code ${err.status}`, undefined, config, {}, res);
    }
  }
  const res = respond(404, { code: 'NOT_FOUND', message: `mock: no route for ${method} ${url}` });
  throw new AxiosError('Request failed with status code 404', undefined, config, {}, res);
};
