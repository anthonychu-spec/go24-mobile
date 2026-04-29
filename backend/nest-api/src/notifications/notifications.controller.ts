import {
  Body, Controller, HttpCode, Post, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { IsString, IsIn, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedUser } from '../auth/jwt.strategy';
import { NotificationsService } from './notifications.service';

class RegisterTokenDto {
  @IsString() token: string;
  @IsIn(['ios', 'android', 'web']) @IsOptional() platform?: string;
}

class CheckinFailedDto {
  @IsString() memberNumber: string;
  @IsString() reason: string;
  @IsString() @IsOptional() club?: string;
  @IsString() @IsOptional() timestamp?: string;
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @ApiOperation({ summary: 'Register device push token' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Post('device')
  @HttpCode(200)
  async registerDevice(@Body() dto: RegisterTokenDto, @Req() req: Request) {
    const user = req.user as AuthedUser;
    await this.svc.registerToken(user.id, dto.token, dto.platform ?? 'ios');
    return { ok: true };
  }

  @ApiOperation({ summary: 'n8n webhook: member failed to enter gym' })
  @Post('webhook/checkin-failed')
  @HttpCode(200)
  async checkinFailed(@Body() dto: CheckinFailedDto) {
    await this.svc.handleCheckinFailed({
      memberNumber: dto.memberNumber,
      reason: dto.reason,
      club: dto.club ?? '',
      timestamp: dto.timestamp ?? new Date().toISOString(),
    });
    return { ok: true };
  }
}
