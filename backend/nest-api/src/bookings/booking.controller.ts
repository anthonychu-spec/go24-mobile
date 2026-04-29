import {
  BadRequestException, Body, Controller, Delete,
  Get, Headers, HttpCode, Param, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedUser } from '../auth/jwt.strategy';
import { BookDto } from './dto/book.dto';
import { BookingsService } from './booking.service';

@ApiTags('bookings')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly svc: BookingsService) {}

  @ApiOperation({ summary: 'Book a class (idempotent)' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'UUID v4 — prevents double-booking on retry' })
  @Post()
  @HttpCode(200)
  async book(
    @Headers('idempotency-key') key: string,
    @Body() dto: BookDto,
    @Req() req: Request,
  ) {
    if (!key) throw new BadRequestException('Idempotency-Key header is required');
    const user = req.user as AuthedUser;
    return this.svc.book({
      userId: user.id,
      pgmId: user.pgmId,
      classId: dto.classId,
      idempotencyKey: key,
      acceptWaitlist: dto.acceptWaitlist,
    });
  }

  @ApiOperation({ summary: 'Cancel a booking (idempotent)' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @Delete(':id')
  @HttpCode(204)
  async cancel(
    @Param('id') id: string,
    @Headers('idempotency-key') key: string,
    @Req() req: Request,
  ) {
    if (!key) throw new BadRequestException('Idempotency-Key header is required');
    const user = req.user as AuthedUser;
    await this.svc.cancel(id, user.id, key);
  }

  @ApiOperation({ summary: 'My bookings' })
  @ApiQuery({ name: 'status', required: false, example: 'confirmed' })
  @Get()
  list(
    @Query('status') status: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthedUser;
    return this.svc.listMine(user.id, status);
  }
}
