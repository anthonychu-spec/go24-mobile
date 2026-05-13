
import {
  Controller, Get, Post, Delete, Query, Param, ParseIntPipe,
  UseGuards, Req, HttpCode,
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

  @ApiOperation({ summary: 'Book a class' })
  @Post('classes/:id/book')
  @HttpCode(200)
  bookClass(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.bookClass(user.pgmId, id);
  }

  @ApiOperation({ summary: 'Cancel booking for a class' })
  @Delete('classes/:id/book')
  @HttpCode(204)
  cancelBooking(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.cancelBooking(user.pgmId, id);
  }
}
