
import { Inject, Injectable } from '@nestjs/common';
import { BOOKING_REPO } from './booking.interfaces';
import type { IBookingRepo } from './booking.interfaces';

@Injectable()
export class BookingService {
  constructor(@Inject(BOOKING_REPO) private readonly repo: IBookingRepo) {}

  listClasses(params: { date: string; clubId?: number }) {
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
      params.date = new Date().toISOString().slice(0, 10);
    }
    return this.repo.listClasses(params);
  }

  getClass(id: number) { return this.repo.getClass(id); }

  listMyBookings(pgmId: number) { return this.repo.listMyBookings(pgmId); }

  bookClass(pgmId: number, classId: number) { return this.repo.bookClass(pgmId, classId); }

  cancelBooking(pgmId: number, classId: number) { return this.repo.cancelBooking(pgmId, classId); }
}
