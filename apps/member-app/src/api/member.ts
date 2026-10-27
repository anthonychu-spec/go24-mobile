import { randomUUID } from 'expo-crypto';
import { brand } from '../brand';
import { API_BASE, apiClient } from './client';

// Typed calls for the member layout. Shapes follow backend/nest-api on feat/backend-week1 (0dade9c).

export interface GymClass {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  clubId: number;
  clubName: string | null;
  instructorName: string | null;
  maxParticipants: number;
  participantsCount: number;
  /** Max standby places; 0 = no waitlist */
  standbyListLimit: number;
  isWaitlist: boolean;
  isCancelled: boolean;
}

export type BookingStatus =
  | 'pending' | 'confirmed' | 'failed' | 'waitlist'
  | 'cancelled' | 'pending_verify' | 'attended' | 'no_show';

export interface MyBooking {
  id: string;
  classId: number;
  clubId: number | null;
  status: BookingStatus;
  waitlistPosition: number | null;
  /** Null when the class has dropped out of PGM's window */
  className: string | null;
  clubName: string | null;
  startTime: string | null;
  endTime: string | null;
  instructorName: string | null;
}

export interface BookResult {
  success: boolean;
  bookingId: string;
  status: BookingStatus;
  error?: string;
}

export interface Dashboard {
  user: { name: string | null; email: string | null; memberCode: string | null };
  membership: { active: boolean; planName: string | null; daysRemaining: number | null; expiresAt: string | null };
  thisMonth: { visits: number; classes: number };
  totalVisits: number;
}

export interface Profile {
  hasMembership: boolean;
  member: {
    pgmId: number;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    memberCode: string | null;
  };
}

export interface Settings {
  reminderMinutes: number;
  autoWaitlistCancel: boolean;
  /** Visits per month the member aims for, 1–31; null = not set */
  visitGoal: number | null;
}

export { VISIT_GOAL_MAX, VISIT_GOAL_MIN } from './rules';

/** GET /me/passport/visits. Counts are null when PGM couldn't be read — show "—", never 0. */
export interface PassportVisits {
  /** YYYY-MM, Hong Kong */
  month: string;
  /** Visits to this brand's clubs this month */
  visitsThisMonth: number | null;
  /** Consecutive Mon–Sun weeks with a visit */
  weeksInARow: number | null;
  visitGoal: number | null;
}

export interface ActivityItem {
  id: string;
  type: 'class' | 'pt' | 'checkin';
  title: string;
  subtitle: string | null;
  at: string;
  club: string | null;
}

export interface Activity {
  summary: {
    classesTotal: number;
    checkinsTotal: number;
    streakDays: number;
    thisMonth: { classes: number; pt: number; checkins: number };
  };
  items: ActivityItem[];
  /** Sources that could not be read (show "not available yet", not zero) */
  errors?: string[];
}

/** Retries with the same key are safe: the backend treats them as one request. */
const idempotent = () => ({ headers: { 'Idempotency-Key': randomUUID() } });

export const classesApi = {
  /** Next `days` days, keyed by YYYY-MM-DD (Hong Kong date) */
  week: (days = 14) =>
    apiClient.get<Record<string, GymClass[]>>('/booking/classes/week', { params: { days } }).then((r) => r.data),
  get: (id: number) => apiClient.get<GymClass>(`/booking/classes/${id}`).then((r) => r.data),
};

export const bookingsApi = {
  list: () => apiClient.get<MyBooking[]>('/bookings').then((r) => r.data),
  /** acceptWaitlist: join the standby list when the class is full */
  book: (classId: number, acceptWaitlist: boolean) =>
    apiClient.post<BookResult>('/bookings', { classId, acceptWaitlist }, idempotent()).then((r) => r.data),
  cancel: (bookingId: string) => apiClient.delete(`/bookings/${bookingId}`, idempotent()).then(() => undefined),
};

export const meApi = {
  dashboard: () => apiClient.get<Dashboard>('/me/dashboard').then((r) => r.data),
  profile: () => apiClient.get<Profile>('/me/profile').then((r) => r.data),
  settings: () => apiClient.get<Settings>('/me/settings').then((r) => r.data),
  updateSettings: (patch: Partial<Settings>) => apiClient.patch<Settings>('/me/settings', patch).then((r) => r.data),
  /** Deletes the app account in every brand app; the PGM membership is untouched */
  deleteAccount: () => apiClient.post<{ status: 'deleted' }>('/me/account/deletion').then((r) => r.data),
  passportVisits: () => apiClient.get<PassportVisits>('/me/passport/visits').then((r) => r.data),
};

/** Public page that deletes an account without the app (email + PGM code); store listings link here */
export const accountDeletionPageUrl = `${API_BASE}/account-deletion?brand=${brand.id}`;

export const activityApi = {
  get: () => apiClient.get<Activity>('/activity').then((r) => r.data),
};
