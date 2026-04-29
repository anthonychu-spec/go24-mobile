import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedUser } from '../auth/jwt.strategy';
import { ActivityService } from './activity.service';

@ApiTags('activity')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly svc: ActivityService) {}

  @ApiOperation({ summary: 'My activity log — classes, PT, check-ins (last 3 months)' })
  @Get()
  get(@Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.getActivity(user.pgmId, user.id);
  }
}
