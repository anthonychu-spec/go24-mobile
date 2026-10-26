
export interface PgmClass {
  id: number;
  name: string;
  startTime: string;       // ISO 8601
  endTime: string;
  clubId: number;
  clubName: string | null;
  instructorName: string | null;
  maxParticipants: number;
  participantsCount: number;
  standbyListLimit: number;  // max standby slots (0 = no waitlist)
  isWaitlist: boolean;
  isCancelled: boolean;
}

export interface PgmBooking {
  bookingId: number;
  classId: number;
  className: string;
  startTime: string;
  endTime: string;
  clubName: string | null;
  clubId: number | null;     // null when the class is outside the cached window
  isStandby: boolean;
  isCancelled: boolean;
}

export interface BookClassResult {
  bookingId: number;
  isStandby: boolean;
}

/** A member's booking row for one class, as PGM currently holds it (deleted rows excluded). */
export interface PgmClassBookingState {
  bookingId: number;
  isStandby: boolean;
  isCancelled: boolean;
}

export interface IBookingRepo {
  listClasses(params: { date: string; clubId?: number }): Promise<PgmClass[]>;
  listWeekClasses(params: { clubId?: number; days?: number }): Promise<Record<string, PgmClass[]>>;
  getClass(classId: number): Promise<PgmClass>;
  listMyBookings(memberId: number): Promise<PgmBooking[]>;
  /** Used by reconcile to find out what PGM really did with a booking whose result was unknown. */
  findMemberBookingsForClass(memberId: number, classId: number): Promise<PgmClassBookingState[]>;
  bookClass(memberId: number, classId: number): Promise<BookClassResult>;
  /** Cancels exactly one PGM booking. Never waives the late-cancellation fee. */
  cancelBooking(pgmBookingId: number): Promise<void>;
}

export const BOOKING_REPO = Symbol('BOOKING_REPO');
