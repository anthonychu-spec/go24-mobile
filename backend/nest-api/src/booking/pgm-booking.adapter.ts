import { Injectable } from '@nestjs/common';
import { PgmClient } from '../pgm-adapter/pgm.client';
import { AppError, normalizePgmError } from '../pgm-adapter/error-normalize';
import {
  BookClassResult, IBookingRepo, PgmBooking, PgmClass,
} from './booking.interfaces';

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
  constructor(private readonly pgm: PgmClient) {}

  async listClasses(params: { date: string; clubId?: number }): Promise<PgmClass[]> {
    try {
      // Fetch classes + lookup tables in parallel
      const [classesRes, typesRes, clubsRes, instructorsRes] = await Promise.allSettled([
        this.pgm.get<{ value: RawClass[] }>('/odata/Classes', {
          $select: 'id,startDate,endDate,classTypeId,clubId,instructorId,attendeesCount,attendeesLimit,isDeleted',
        }),
        this.pgm.get<{ value: RawClassType[] }>('/odata/ClassTypes', { $select: 'id,name' }),
        this.pgm.get<{ value: RawClub[] }>('/odata/Clubs', { $select: 'id,name' }),
        this.pgm.get<{ value: RawInstructor[] }>('/odata/Instructors', { $select: 'id,firstName,lastName' }),
      ]);

      const allClasses = classesRes.status === 'fulfilled' ? (classesRes.value.value ?? []) : [];

      // Build lookup maps — fall back gracefully if endpoint fails
      const classTypeMap = new Map<number, string>();
      if (typesRes.status === 'fulfilled') {
        for (const t of (typesRes.value.value ?? [])) {
          classTypeMap.set(t.id, t.name);
        }
      }

      const clubMap = new Map<number, string>();
      if (clubsRes.status === 'fulfilled') {
        for (const c of (clubsRes.value.value ?? [])) {
          clubMap.set(c.id, c.name);
        }
      }

      const instructorMap = new Map<number, string>();
      if (instructorsRes.status === 'fulfilled') {
        for (const i of (instructorsRes.value.value ?? [])) {
          const fullName = [i.firstName, i.lastName].filter(Boolean).join(' ');
          if (fullName) instructorMap.set(i.id, fullName);
        }
      }

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
      const [classesRes, typesRes, clubsRes, instructorsRes] = await Promise.allSettled([
        this.pgm.get<{ value: RawClass[] }>('/odata/Classes', {
          $select: 'id,startDate,endDate,classTypeId,clubId,instructorId,attendeesCount,attendeesLimit,isDeleted',
        }),
        this.pgm.get<{ value: RawClassType[] }>('/odata/ClassTypes', { $select: 'id,name' }),
        this.pgm.get<{ value: RawClub[] }>('/odata/Clubs', { $select: 'id,name' }),
        this.pgm.get<{ value: RawInstructor[] }>('/odata/Instructors', { $select: 'id,firstName,lastName' }),
      ]);

      const item = (classesRes.status === 'fulfilled' ? classesRes.value.value ?? [] : []).find(c => c.id === classId);
      if (!item) throw new AppError('CLASS_NOT_FOUND');

      const classTypeMap = new Map<number, string>();
      if (typesRes.status === 'fulfilled') for (const t of (typesRes.value.value ?? [])) classTypeMap.set(t.id, t.name);

      const clubMap = new Map<number, string>();
      if (clubsRes.status === 'fulfilled') for (const c of (clubsRes.value.value ?? [])) clubMap.set(c.id, c.name);

      const instructorMap = new Map<number, string>();
      if (instructorsRes.status === 'fulfilled') {
        for (const i of (instructorsRes.value.value ?? [])) {
          const fullName = [i.firstName, i.lastName].filter(Boolean).join(' ');
          if (fullName) instructorMap.set(i.id, fullName);
        }
      }

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
