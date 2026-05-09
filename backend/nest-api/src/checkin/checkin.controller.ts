import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createHmac, randomBytes } from 'node:crypto';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedUser } from '../auth/jwt.strategy';

@ApiTags('checkin')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('checkin')
export class CheckinController {
  constructor(private readonly cfg: ConfigService) {}

  @ApiOperation({ summary: 'Generate QR check-in payload (valid 30s)' })
  @Get('qr')
  getQr(@Req() req: Request) {
    const user = req.user as AuthedUser;
    const expiresAt = new Date(Date.now() + 30_000);

    // Payload: userId|pgmId|expiresAt|nonce
    const nonce = randomBytes(8).toString('hex');
    const body = `${user.id}|${user.pgmId}|${expiresAt.toISOString()}|${nonce}`;
    const secret = this.cfg.get<string>('JWT_SECRET') ?? 'fallback';
    const sig = createHmac('sha256', secret).update(body).digest('hex').slice(0, 16);

    return {
      payload: `${body}|${sig}`,
      userId: user.id,
      pgmId: user.pgmId,
      expiresAt: expiresAt.toISOString(),
    };
  }
}
