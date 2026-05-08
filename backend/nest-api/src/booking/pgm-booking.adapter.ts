import { Injectable, Logger } from '@nestjs/common';
import { PgmClient } from '../pgm-adapter/pgm.client';
import { AppError, normalizePgmError } from '../pgm-adapter/error-normalize';
import {
  BookClassResult, IBookingRepo, PgmBooking, PgmClass,
} from './booking.interfaces';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

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
  private classTypeCache: CacheEntry<Map<number, string>> | null = null;
  private clubCache:      CacheEntry<Map<number, string>> | null = null;
  private instructorCache: CacheEntry<Map<number, string>> | null = null;

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

  async listClasses(params: { date: string; clubId?: number }): Promise<PgmClass[]> {
    try {
      // Fetch classes + cached lookup tables in parallel
      const [classesRes, classTypeMap, clubMap, instructorMap] = await Promise.all([
        this.pgm.get<{ value: RawClass[] }>('/odata/Classes', {
          $select: 'id,startDate,endDate,classTypeId,clubId,instructorId,attendeesCount,attendeesLimit,isDeleted',
        }),
        this.getClassTypeMap(),
        this.getClubMap(),
        this.getInstructorMap(),
      ]);

      const allClasses = classesRes.value ?? [];

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
      const [res, classTypeMap, clubMap, instructorMap] = await Promise.all([
        this.pgm.get<{ value: RawClass[] }>('/odata/Classes', {
          $select: 'id,startDate,endDate,classTypeId,clubId,instructorId,attendeesCount,attendeesLimit,isDeleted',
        }),
        this.getClassTypeMap(),
        this.getClubMap(),
        this.getInstructorMap(),
      ]);
      const item = (res.value ?? []).find(c => c.id === classId);
      if (!item) throw new AppError('CLASS_NOT_FOUND');
      return this.mapClass(item, classTypeMap, clubMap, instructorMap);
    } catch (err) {
      throw normalizePgmError(err);
    }
  }

  async listMyBookings(memberId: number): Promise<PgmBooking[]> {
    try {
      const res = await this.pgm.get<{ value: RawBooking[] }>('/odata/ClassBookings', {
        $select: 'id,classId,startDate,endDate,memberId,isStandby,isCancelled',
      });
      return (res.value ?? [])
        .filter(b => b.memberId === memberId && !b.isCancelled)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
        .slice(0, 50)
        .map(b => this.mapBooking(b));
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
