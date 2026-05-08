
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
  isStandby: boolean;
  isCancelled: boolean;
}

export interface BookClassResult {
  bookingId: number;
  isStandby: boolean;
}

export interface IBookingRepo {
  listClasses(params: { date: string; clubId?: number }): Promise<PgmClass[]>;
  listWeekClasses(params: { clubId?: number; days?: number }): Promise<Record<string, PgmClass[]>>;
  getClass(classId: number): Promise<PgmClass>;
  listMyBookings(memberId: number): Promise<PgmBooking[]>;
  bookClass(memberId: number, classId: number): Promise<BookClassResult>;
  cancelBooking(memberId: number, classId: number): Promise<void>;
}

export const BOOKING_REPO = Symbol('BOOKING_REPO');
