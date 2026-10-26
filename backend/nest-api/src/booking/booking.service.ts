import { Inject, Injectable } from '@nestjs/common';
import { BOOKING_REPO } from './booking.interfaces';
import type { IBookingRepo, PgmClass } from './booking.interfaces';
import { BrandService } from '../brand/brand.service';
import type { BrandId } from '../brand/brand.constants';
import { AppError } from '../pgm-adapter/error-normalize';

/** Read side of class booking. Every result is limited to the caller's brand clubs. */
@Injectable()
export class BookingService {
  constructor(
    @Inject(BOOKING_REPO) private readonly repo: IBookingRepo,
    private readonly brands: BrandService,
  ) {}

  async listClasses(params: { date: string; clubId?: number }, brand: BrandId) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
      params.date = new Date().toISOString().slice(0, 10);
    }
    return this.onlyBrand(await this.repo.listClasses(params), brand);
  }

  async listWeekClasses(params: { clubId?: number; days?: number }, brand: BrandId) {
    const week = await this.repo.listWeekClasses(params);
    const clubs = new Set(await this.brands.clubIds(brand));
    return Object.fromEntries(
      Object.entries(week).map(([day, classes]) => [day, classes.filter(c => clubs.has(c.clubId))]),
    );
  }

  async getClass(id: number, brand: BrandId) {
    const cls = await this.repo.getClass(id);
    // Another brand's class is reported as missing, not forbidden
    if (!(await this.brands.ownsClub(brand, cls.clubId))) throw new AppError('CLASS_NOT_FOUND');
    return cls;
  }

  async listMyBookings(pgmId: number, brand: BrandId) {
    const clubs = new Set(await this.brands.clubIds(brand));
    return (await this.repo.listMyBookings(pgmId)).filter(b => b.clubId != null && clubs.has(b.clubId));
  }

  private async onlyBrand(classes: PgmClass[], brand: BrandId): Promise<PgmClass[]> {
    const clubs = new Set(await this.brands.clubIds(brand));
    return classes.filter(c => clubs.has(c.clubId));
  }
}
