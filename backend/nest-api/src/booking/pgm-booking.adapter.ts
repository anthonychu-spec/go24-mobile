import { Injectable, Logger } from '@nestjs/common';
import { PgmClient } from '../pgm-adapter/pgm.client';
import { AppError, normalizePgmError } from '../pgm-adapter/error-normalize';
import {
  BookClassResult, IBookingRepo, PgmBooking, PgmClass,
} from './booking.interfaces';

const CACHE_TTL_MS       = 60 * 60 * 1000; // 1 hour  — lookup tables
const CLASSES_CACHE_TTL  = 8 * 1000;       // 8s      — raw class list (live capacity, fast for rush booking)

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface RawClass {
  id: number;
  startDate: string;
  endDate: string;
  classTypeId: number;
  clubId: number;
  instructorId: number | null;
  attendeesCount: number;
  attendeesLimit: number;
  standbyListLimit: number;
  isDeleted: boolean;
}

interface RawClassType {
  id: number;
  name: string;
}

interface RawClub {
  id: number;
  name: string;
}

interface RawInstructor {
  id: number;
  firstName: string;
  lastName: string;
}

interface RawBooking {
  id: number;
  classId: number;
  startDate: string;
  endDate: string;
  memberId: number;
  isStandby: boolean;
  isCanceled: boolean;   // PGM uses single-l spelling
  isDeleted: boolean;
  hasAttended: boolean;
}

@Injectable()
export class PgmBookingAdapter implements IBookingRepo {
  private readonly logger = new Logger(PgmBookingAdapter.name);

  // In-memory cache for lookup tables (class types, clubs, instructors)
  private classTypeCache:   CacheEntry<Map<number, string>> | null = null;
  private clubCache:        CacheEntry<Map<number, string>> | null = null;
  private instructorCache:  CacheEntry<Map<number, string>> | null = null;
  // Short-lived cache for raw PGM class list (live capacity, 30s)
  private rawClassCache:    CacheEntry<RawClass[]> | null = null;

  constructor(private readonly pgm: PgmClient) {}

  private isFresh<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
    return entry !== null && Date.now() < entry.expiresAt;
  }

  private async getClassTypeMap(): Promise<Map<number, string>> {
    if (this.isFresh(this.classTypeCache)) return this.classTypeCache.data;
    try {
      const res = await this.pgm.get<{ value: RawClassType[] }>('/odata/ClassTypes', { $select: 'id,name' });
      const map = new Map<number, string>();
      for (const t of (res.value ?? [])) map.set(t.id, t.name);
      this.classTypeCache = { data: map, expiresAt: Date.now() + CACHE_TTL_MS };
      this.logger.log(`ClassTypes cached: ${map.size} entries`);
      return map;
    } catch (err) {
      this.logger.warn('ClassTypes fetch failed, using empty map');
      return new Map();
    }
  }

  private async getClubMap(): Promise<Map<number, string>> {
    if (this.isFresh(this.clubCache)) return this.clubCache.data;
    try {
      const res = await this.pgm.get<{ value: RawClub[] }>('/odata/Clubs', { $select: 'id,name' });
      const map = new Map<number, string>();
      for (const c of (res.value ?? [])) map.set(c.id, c.name);
      this.clubCache = { data: map, expiresAt: Date.now() + CACHE_TTL_MS };
      this.logger.log(`Clubs cached: ${map.size} entries`);
      return map;
    } catch (err) {
      this.logger.warn('Clubs fetch failed, using empty map');
      return new Map();
    }
  }

  private async getInstructorMap(): Promise<Map<number, string>> {
    if (this.isFresh(this.instructorCache)) return this.instructorCache.data;
    try {
      const res = await this.pgm.get<{ value: RawInstructor[] }>('/odata/Instructors', { $select: 'id,firstName,lastName' });
      const map = new Map<number, string>();
      for (const i of (res.value ?? [])) {
        const name = [i.firstName, i.lastName].filter(Boolean).join(' ');
        if (name) map.set(i.id, name);
      }
      this.instructorCache = { data: map, expiresAt: Date.now() + CACHE_TTL_MS };
      this.logger.log(`Instructors cached: ${map.size} entries`);
      return map;
    } catch (err) {
      this.logger.warn('Instructors fetch failed, using empty map');
      return new Map();
    }
  }

  /** Fetch raw classes from PGM with 30s cache (live capacity) */
  private async getRawClasses(): Promise<RawClass[]> {
    if (this.isFresh(this.rawClassCache)) return this.rawClassCache.data;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const windowEnd = new Date(today); windowEnd.setDate(today.getDate() + 10);
    const from = today.toISOString().slice(0, 10);
    const to   = windowEnd.toISOString().slice(0, 10);
    const res = await this.pgm.get<{ value: RawClass[] }>('/odata/Classes', {
      $select: 'id,startDate,endDate,classTypeId,clubId,instructorId,attendeesCount,attendeesLimit,standbyListLimit,isDeleted',
      $filter: `startDate ge ${from}T00:00:00Z and startDate le ${to}T23:59:59Z`,
    });
    const classes = res.value ?? [];
    this.rawClassCache = { data: classes, expiresAt: Date.now() + CLASSES_CACHE_TTL };
    return classes;
  }

  /** Return classes for the next N days (default 7), grouped by ISO date string */
  async listWeekClasses(params: { clubId?: number; days?: number } = {}): Promise<Record<string, PgmClass[]>> {
    try {
      const days = params.days ?? 9; // 216h = 9 days
      const [allClasses, classTypeMap, clubMap, instructorMap] = await Promise.all([
        this.getRawClasses(),
        this.getClassTypeMap(),
        this.getClubMap(),
        this.getInstructorMap(),
      ]);

      // Build date window: today through today+(days-1)
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const windowEnd = new Date(today); windowEnd.setDate(today.getDate() + days);
      windowEnd.setHours(23, 59, 59, 999);

      const result: Record<string, PgmClass[]> = {};

      // Pre-populate all days so empty days still have an array
      for (let i = 0; i < days; i++) {
        const d = new Date(today); d.setDate(today.getDate() + i);
        result[d.toISOString().slice(0, 10)] = [];
      }

      for (const c of allClasses) {
        if (c.isDeleted) continue;
        const start = new Date(c.startDate);
        if (isNaN(start.getTime()) || start < today || start > windowEnd) continue;
        if (params.clubId && c.clubId !== params.clubId) continue;
        const key = start.toISOString().slice(0, 10);
        if (key in result) result[key].push(this.mapClass(c, classTypeMap, clubMap, instructorMap));
      }

      // Sort each day's classes by start time
      for (const key of Object.keys(result)) {
        result[key].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      }

      return result;
    } catch (err) {
      throw normalizePgmError(err);
    }
  }

  async listClasses(params: { date: string; clubId?: number }): Promise<PgmClass[]> {
    try {
      // Fetch classes (cached 30s) + lookup tables in parallel
      const [allClasses, classTypeMap, clubMap, instructorMap] = await Promise.all([
        this.getRawClasses(),
        this.getClassTypeMap(),
        this.getClubMap(),
        this.getInstructorMap(),
      ]);
      const target = new Date(params.date);
      const dayStart = new Date(target); dayStart.setHours(0, 0, 0, 0);
      const dayEnd   = new Date(target); dayEnd.setHours(23, 59, 59, 999);

      let filtered = allClasses.filter(c => {
        if (c.isDeleted) return false;
        const d = new Date(c.startDate);
        if (isNaN(d.getTime())) return false;
        return d >= dayStart && d <= dayEnd;
      });

      // No classes on requested date — return nearest 20 for dev/testing
      if (filtered.length === 0) {
        const sorted = [...allClasses]
          .filter(c => !c.isDeleted)
          .sort((a, b) =>
            Math.abs(new Date(a.startDate).getTime() - target.getTime()) -
            Math.abs(new Date(b.startDate).getTime() - target.getTime()),
          );
        filtered = sorted.slice(0, 20);
      }

      if (params.clubId) filtered = filtered.filter(c => c.clubId === params.clubId);
      return filtered.map(c => this.mapClass(c, classTypeMap, clubMap, instructorMap));
    } catch (err) {
      throw normalizePgmError(err);
    }
  }

  async getClass(classId: number): Promise<PgmClass> {
    try {
      const [allClasses, classTypeMap, clubMap, instructorMap] = await Promise.all([
        this.getRawClasses(),
        this.getClassTypeMap(),
        this.getClubMap(),
        this.getInstructorMap(),
      ]);
      const item = allClasses.find(c => c.id === classId);
      if (!item) throw new AppError('CLASS_NOT_FOUND');
      return this.mapClass(item, classTypeMap, clubMap, instructorMap);
    } catch (err) {
      throw normalizePgmError(err);
    }
  }

  async listMyBookings(memberId: number): Promise<PgmBooking[]> {
    try {
      const [bookingsRes, classTypeMap, clubMap] = await Promise.all([
        this.pgm.get<{ value: RawBooking[] }>('/odata/ClassBookings', {
          $filter: `memberId eq ${memberId}`,
          $select: 'id,classId,startDate,endDate,memberId,isStandby,isCancelled',
          $orderby: 'startDate desc',
          $top: 50,
        }),
        this.getClassTypeMap(),
        this.getClubMap(),
      ]);

      const allClasses = await this.getRawClasses();
      const classMap = new Map<number, RawClass>();
      for (const c of allClasses) classMap.set(c.id, c);

      return (bookingsRes.value ?? [])
        .filter(b => !b.isCanceled && !b.isDeleted)
        .map(b => {
          const cls = classMap.get(b.classId);
          return {
            bookingId: b.id,
            classId: b.classId,
            className: cls ? (classTypeMap.get(cls.classTypeId) ?? `Class ${b.classId}`) : `Class ${b.classId}`,
            startTime: b.startDate,
            endTime: b.endDate,
            clubName: cls ? (clubMap.get(cls.clubId) ?? null) : null,
            isStandby: b.isStandby ?? false,
            isCancelled: b.isCanceled ?? false,
          };
        });
    } catch (err) {
      throw normalizePgmError(err);
    }
  }

  /** Fetch historical bookings (last N months) with full class name enrichment. */
  async listHistoricalBookings(memberId: number, since: Date): Promise<PgmBooking[]> {
    // Extend class window: 12 months back → 3 months forward to cover all booking dates
    const classFrom = new Date(); classFrom.setMonth(classFrom.getMonth() - 12);
    const classTo   = new Date(); classTo.setMonth(classTo.getMonth() + 3);
    const fromStr   = classFrom.toISOString().slice(0, 10);
    const toStr     = classTo.toISOString().slice(0, 10);

    const [bookingsResult, classesResult, classTypeMap, clubMap] = await Promise.allSettled([
      this.pgm.get<{ value: any[] }>('/odata/ClassBookings', {
        $filter: `memberId eq ${memberId}`,
        $top: 200,
      }),
      this.pgm.get<{ value: RawClass[] }>('/odata/Classes', {
        $filter: `startDate ge ${fromStr}T00:00:00Z and startDate le ${toStr}T23:59:59Z`,
        $select: 'id,startDate,endDate,classTypeId,clubId',
        $top: 2000,
      }),
      this.getClassTypeMap(),
      this.getClubMap(),
    ]);

    if (bookingsResult.status === 'rejected') {
      this.logger.error('ClassBookings fetch failed', bookingsResult.reason?.message ?? bookingsResult.reason);
      return [];
    }
    if (classesResult.status === 'rejected') {
      this.logger.warn('Historical Classes fetch failed — names will fall back', classesResult.reason?.message ?? classesResult.reason);
    }

    const bookings  = bookingsResult.value.value ?? [];
    const classes   = classesResult.status === 'fulfilled' ? (classesResult.value.value ?? []) : [];
    const typeMap   = classTypeMap.status === 'fulfilled' ? classTypeMap.value : new Map<number, string>();
    const cMap      = clubMap.status === 'fulfilled' ? clubMap.value : new Map<number, string>();

    const classMap = new Map<number, RawClass>();
    for (const c of classes) classMap.set(c.id, c);

    this.logger.log(
      `listHistoricalBookings: bookings=${bookings.length} classes=${classes.length} classMap=${classMap.size} typeMap=${typeMap.size}`,
    );
    if (bookings.length > 0) this.logger.log(`sample booking keys: ${Object.keys(bookings[0]).join(',')}`);
    if (classes.length > 0) this.logger.log(`sample class keys: ${Object.keys(classes[0]).join(',')}`);

    const results = bookings
      .filter(b => !b.isCanceled && !b.isDeleted)
      .map(b => {
        const cls = classMap.get(b.classId);
        return {
          bookingId:   b.id,
          classId:     b.classId,
          className:   cls ? (typeMap.get(cls.classTypeId) ?? `Class #${b.classId}`) : `Class #${b.classId}`,
          startTime:   b.startDate,
          endTime:     b.endDate,
          clubName:    cls ? (cMap.get(cls.clubId) ?? null) : null,
          isStandby:   b.isStandby  ?? false,
          isCancelled: b.isCancelled ?? false,
        };
      });

    const resolved = results.filter(r => !r.className.startsWith('Class #')).length;
    this.logger.log(`listHistoricalBookings: ${results.length} bookings, ${resolved} names resolved`);
    return results;
  }

  async bookClass(memberId: number, classId: number): Promise<BookClassResult> {
    try {
      return await this.pgm.post<BookClassResult>('/ClassBooking/BookClass', {
        memberId,
        classId,
        bookDespiteOtherBookingsAtTheSameTime: false,
        seatNumber: null,
        comments: '',
      });
    } catch (err) {
      throw normalizePgmError(err);
    }
  }

  async cancelBooking(memberId: number, classId: number): Promise<void> {
    try {
      await this.pgm.post('/ClassBooking/CancelMemberBookingsForClass', { memberId, classId });
    } catch (err) {
      throw normalizePgmError(err);
    }
  }

  private mapClass(
    c: RawClass,
    classTypeMap: Map<number, string> = new Map(),
    clubMap: Map<number, string> = new Map(),
    instructorMap: Map<number, string> = new Map(),
  ): PgmClass {
    return {
      id: c.id,
      name: classTypeMap.get(c.classTypeId) ?? `Class Type ${c.classTypeId}`,
      startTime: c.startDate,
      endTime: c.endDate,
      clubId: c.clubId,
      clubName: clubMap.get(c.clubId) ?? null,
      instructorName: c.instructorId ? (instructorMap.get(c.instructorId) ?? null) : null,
      maxParticipants: c.attendeesLimit,
      participantsCount: c.attendeesCount,
      standbyListLimit: c.standbyListLimit ?? 0,
      isWaitlist: false,
      isCancelled: false,
    };
  }

  private mapBooking(b: RawBooking): PgmBooking {
    return {
      bookingId: b.id,
      classId: b.classId,
      className: 'Class ' + String(b.classId),
      startTime: b.startDate,
      endTime: b.endDate,
      clubName: null,
      isStandby: b.isStandby ?? false,
      isCancelled: b.isCanceled ?? false,
    };
  }
}
