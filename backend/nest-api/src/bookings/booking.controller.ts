import {
  BadRequestException, Body, Controller, Delete,
  Get, Headers, HttpCode, Logger, Param, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

/* ── PGM Webhook Controller (no JWT — secured by shared secret) ── */

@ApiTags('webhooks')
@Controller('webhooks/pgm')
export class PgmWebhookController {
  private readonly logger = new Logger(PgmWebhookController.name);
  private readonly secret: string;

  constructor(
    private readonly svc: BookingsService,
    private readonly cfg: ConfigService,
  ) {
    this.secret = cfg.get<string>('PGM_WEBHOOK_SECRET') ?? '';
  }

  @ApiOperation({ summary: 'PGM ClassesBookingCancelled webhook' })
  @Post('booking-cancelled')
  @HttpCode(200)
  async bookingCancelled(@Body() body: any, @Headers('x-webhook-secret') secret: string) {
    if (this.secret && secret !== this.secret) {
      this.logger.warn('PGM webhook rejected: bad secret');
      throw new BadRequestException('Invalid webhook secret');
    }
    const bookingId = body?.bookingId ?? body?.BookingId ?? body?.id;
    if (!bookingId) {
      this.logger.warn('PGM cancel webhook: missing bookingId', body);
      return { ok: false, reason: 'missing bookingId' };
    }
    await this.svc.handlePgmCancelled(Number(bookingId));
    return { ok: true };
  }

  @ApiOperation({ summary: 'PGM ClassesBookingPromotedFromStandbyList webhook' })
  @Post('booking-promoted')
  @HttpCode(200)
  async bookingPromoted(@Body() body: any, @Headers('x-webhook-secret') secret: string) {
    if (this.secret && secret !== this.secret) {
      this.logger.warn('PGM webhook rejected: bad secret');
      throw new BadRequestException('Invalid webhook secret');
    }
    const bookingId = body?.bookingId ?? body?.BookingId ?? body?.id;
    if (!bookingId) {
      this.logger.warn('PGM promoted webhook: missing bookingId', body);
      return { ok: false, reason: 'missing bookingId' };
    }
    await this.svc.handlePgmPromoted(Number(bookingId));
    return { ok: true };
  }
}
