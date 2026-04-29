import {
  Body, Controller, Get, HttpCode, Param,
  Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import type { Request } from 'express';
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

  @ApiOperation({ summary: 'My notifications' })
  @ApiQuery({ name: 'tab', enum: ['personal', 'announcements'], required: false })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Query('tab') tab: 'personal' | 'announcements' = 'personal', @Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.list(user.id, tab);
  }

  @ApiOperation({ summary: 'Unread count' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Get('unread-count')
  unreadCount(@Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.unreadCount(user.id);
  }

  @ApiOperation({ summary: 'Mark one notification as read' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  @HttpCode(200)
  markRead(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.markRead(user.id, id);
  }

  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Patch('read-all')
  @HttpCode(200)
  markAllRead(@Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.markAllRead(user.id);
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
