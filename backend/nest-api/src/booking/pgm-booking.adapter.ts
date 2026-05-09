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
  isCancelled: boolean;
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
    const windowEnd = new Date(today); windowEnd.setDate(today.getDate() + 8);
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
      const days = params.days ?? 7;
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
        .filter(b => !b.isCancelled)
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
            isCancelled: b.isCancelled ?? false,
          };
        });
    } catch (err) {
      throw normalizePgmError(err);
    }
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
      isCancelled: b.isCancelled ?? false,
    };
  }
}
