import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { bookingsApi, type BookResult, type MyBooking } from '../../api/member';
import { apiErrorMessage } from '../../api/errors';
import { isFuture } from '../../lib/hkTime';

// Bookings shared by Home, Book and Passport so a booking made on one tab shows on the others.

const LIVE = new Set(['confirmed', 'waitlist', 'pending', 'pending_verify']);

interface MemberDataState {
  bookings: MyBooking[];
  /** Future bookings that still hold (or wait for) a place, soonest first */
  upcoming: MyBooking[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Throws the API error; refreshes the list either way */
  book: (classId: number, acceptWaitlist: boolean) => Promise<BookResult>;
  cancel: (bookingId: string) => Promise<void>;
  /** The live booking for a class, if any */
  bookingFor: (classId: number) => MyBooking | undefined;
}

const Ctx = createContext<MemberDataState | null>(null);

export function MemberDataProvider({ children }: { children: ReactNode }) {
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setBookings(await bookingsApi.list());
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const book = useCallback(async (classId: number, acceptWaitlist: boolean) => {
    try {
      return await bookingsApi.book(classId, acceptWaitlist);
    } finally {
      void refresh();
    }
  }, [refresh]);

  const cancel = useCallback(async (bookingId: string) => {
    try {
      await bookingsApi.cancel(bookingId);
    } finally {
      void refresh();
    }
  }, [refresh]);

  const value = useMemo<MemberDataState>(() => {
    const upcoming = bookings
      .filter((b) => LIVE.has(b.status) && isFuture(b.startTime))
      .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
    return {
      bookings, upcoming, loading, error, refresh, book, cancel,
      bookingFor: (classId) => bookings.find((b) => b.classId === classId && LIVE.has(b.status)),
    };
  }, [bookings, loading, error, refresh, book, cancel]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMemberData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMemberData must be inside MemberDataProvider');
  return ctx;
}
