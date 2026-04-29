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
      // PGM OData does not support server-side $filter — fetch all and filter client-side
      const res = await this.pgm.get<{ value: RawClass[] }>('/odata/Classes', {
        $select: 'id,startDate,endDate,classTypeId,clubId,instructorId,attendeesCount,attendeesLimit,isDeleted',
      });

      const allClasses = res.value ?? [];
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
      return filtered.map(c => this.mapClass(c));
    } catch (err) {
      throw normalizePgmError(err);
    }
  }

  async getClass(classId: number): Promise<PgmClass> {
    try {
      const res = await this.pgm.get<{ value: RawClass[] }>('/odata/Classes', {
        $select: 'id,startDate,endDate,classTypeId,clubId,instructorId,attendeesCount,attendeesLimit,isDeleted',
      });
      const item = (res.value ?? []).find(c => c.id === classId);
      if (!item) throw new AppError('CLASS_NOT_FOUND');
      return this.mapClass(item);
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

  private mapClass(c: RawClass): PgmClass {
    return {
      id: c.id,
      name: 'ClassType ' + String(c.classTypeId),
      startTime: c.startDate,
      endTime: c.endDate,
      clubId: c.clubId,
      clubName: null,
      instructorName: null,
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
