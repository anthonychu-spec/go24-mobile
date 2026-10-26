
import {
  Controller, Get, Query, Param, ParseIntPipe, UseGuards, Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedUser } from '../auth/jwt.strategy';
import { BookingService } from './booking.service';

@ApiTags('booking')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('booking')
export class BookingController {
  constructor(private readonly svc: BookingService) {}

  @ApiOperation({ summary: 'List classes for a date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'date', required: true, example: '2026-04-29' })
  @ApiQuery({ name: 'clubId', required: false, type: Number })
  @Get('classes')
  listClasses(
    @Query('date') date: string,
    @Query('clubId') clubId?: string,
  ) {
    return this.svc.listClasses({ date, clubId: clubId ? Number(clubId) : undefined });
  }

  @ApiOperation({ summary: 'List classes for next 7 days (live capacity, 30s cache)' })
  @ApiQuery({ name: 'clubId', required: false, type: Number })
  @ApiQuery({ name: 'days', required: false, type: Number, example: 7 })
  @Get('classes/week')
  listWeekClasses(
    @Query('clubId') clubId?: string,
    @Query('days') days?: string,
  ) {
    return this.svc.listWeekClasses({
      clubId: clubId ? Number(clubId) : undefined,
      days: days ? Number(days) : 14,
    });
  }

  @ApiOperation({ summary: 'Get single class by ID' })
  @Get('classes/:id')
  getClass(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getClass(id);
  }

  @ApiOperation({ summary: 'My upcoming bookings' })
  @Get('my')
  myBookings(@Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.listMyBookings(user.pgmId);
  }

  // Booking and cancelling go through POST/DELETE /bookings (idempotency key,
  // 1-per-day limit, 168h window, reconcile). The old /booking/classes/:id/book
  // routes bypassed all of that and were removed.
}
