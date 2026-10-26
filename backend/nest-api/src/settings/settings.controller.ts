import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedUser } from '../auth/jwt.strategy';
import { SettingsService } from './settings.service';

class UpdateSettingsDto {
  @IsOptional() @IsInt() @Min(0) @Max(1440) reminderMinutes?: number;
  @IsOptional() @IsBoolean() autoWaitlistCancel?: boolean;
}

@ApiTags('settings')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('me/settings')
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  @ApiOperation({ summary: 'Get notification and preference settings' })
  @Get()
  get(@Req() req: Request) {
    return this.svc.get((req.user as AuthedUser).id);
  }

  @ApiOperation({ summary: 'Update settings (reminderMinutes, autoWaitlistCancel)' })
  @Patch()
  update(
    @Req() req: Request,
    @Body() body: UpdateSettingsDto,
  ) {
    return this.svc.update((req.user as AuthedUser).id, body);
  }
}
