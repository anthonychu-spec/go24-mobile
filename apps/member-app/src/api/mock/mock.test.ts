import axios from 'axios';
import { apiErrorCode } from '../errors';
import type { BookResult, GymClass, PassportVisits, Settings } from '../member';
import { mockAdapter } from './index';

// The mock must answer like backend/nest-api (feat/backend-week1), so screens built on it
// behave the same against the real server. Jest runs with APP_BRAND = lab (package.json).

const api = axios.create({ baseURL: 'http://mock/v1', adapter: mockAdapter, headers: { Authorization: 'Bearer mock-access' } });
const anon = axios.create({ baseURL: 'http://mock/v1', adapter: mockAdapter });

async function codeOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (err) {
    return apiErrorCode(err);
  }
  throw new Error('expected the request to fail');
}

async function classesByDay() {
  const { data } = await api.get<Record<string, GymClass[]>>('/booking/classes/week', { params: { days: 8 } });
  return Object.values(data);
}

describe('mock API', () => {
  it('needs a bearer token on member routes but not on app-config', async () => {
    expect(await codeOf(anon.get('/me/profile'))).toBe('UNKNOWN'); // bare 401
    const { data } = await anon.get('/app-config');
    expect(data.brand).toBe('lab');
    expect(data.features.classes).toBe(true);
  });

  it('answers brand-disabled routes like the feature guard: 404 with no code', async () => {
    expect(await codeOf(api.post('/coaching/enquiries', { clubId: 45, goal: 'x' }))).toBe('FEATURE_OFF');
    expect(await codeOf(api.get('/checkin/qr'))).toBe('FEATURE_OFF');
  });

  it('enforces one class per Hong Kong day with DAILY_LIMIT', async () => {
    const days = await classesByDay();
    // A day with two open, not-yet-started classes and nothing booked
    const { data: mine } = await api.get<{ classId: number; status: string }[]>('/bookings');
    const day = days.find((d) => {
      const open = d.filter((c) => new Date(c.startTime).getTime() > Date.now() && c.participantsCount < c.maxParticipants);
      return open.length >= 2 && !d.some((c) => mine.some((b) => b.classId === c.id && b.status === 'confirmed'));
    })!;
    const [first, second] = day.filter((c) => c.participantsCount < c.maxParticipants && new Date(c.startTime).getTime() > Date.now());

    const ok = await api.post<BookResult>('/bookings', { classId: first.id, acceptWaitlist: false });
    expect(ok.data).toMatchObject({ success: true, status: 'confirmed' });
    expect(await codeOf(api.post('/bookings', { classId: second.id }))).toBe('DAILY_LIMIT');
    expect(await codeOf(api.post('/bookings', { classId: first.id }))).toBe('DUPLICATE_BOOKING');
  });

  it('rejects classes past the 168-hour window with OUTSIDE_BOOKING_WINDOW', async () => {
    const { data } = await api.get<Record<string, GymClass[]>>('/booking/classes/week', { params: { days: 14 } });
    const far = Object.values(data).flat().find((c) => new Date(c.startTime).getTime() > Date.now() + 168 * 3600_000)!;
    expect(await codeOf(api.post('/bookings', { classId: far.id }))).toBe('OUTSIDE_BOOKING_WINDOW');
  });

  it('returns passport visits with a nullable goal, and stores goals 1–31', async () => {
    const { data } = await api.get<PassportVisits>('/me/passport/visits');
    expect(data.month).toMatch(/^\d{4}-\d{2}$/);
    expect(typeof data.visitsThisMonth).toBe('number');
    expect(typeof data.weeksInARow).toBe('number');
    expect(data.visitGoal).toBeNull();

    const saved = await api.patch<Settings>('/me/settings', { visitGoal: 12 });
    expect(saved.data.visitGoal).toBe(12);
    expect((await api.get<PassportVisits>('/me/passport/visits')).data.visitGoal).toBe(12);
    expect(await codeOf(api.patch('/me/settings', { visitGoal: 32 }))).toBe('UNKNOWN'); // validation 400
  });

  it('deletes the account and then refuses the old session', async () => {
    const { data } = await api.post('/me/account/deletion');
    expect(data).toEqual({ status: 'deleted' });
    expect(await codeOf(api.get('/me/profile'))).toBe('UNKNOWN'); // 401
    expect(await codeOf(anon.post('/auth/refresh', { refreshToken: 'mock-refresh' }))).toBe('UNKNOWN'); // 401
  });
});
