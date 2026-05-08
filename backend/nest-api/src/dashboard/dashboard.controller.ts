import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedUser } from '../auth/jwt.strategy';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('me')
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  @ApiOperation({ summary: 'Dashboard summary — membership, PT, next class, this month stats' })
  @Get('dashboard')
  dashboard(@Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.getDashboard(user.id, user.pgmId, null);
  }

  @ApiOperation({ summary: 'All memberships (current + ended) with plan names' })
  @Get('memberships')
  memberships(@Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.getMemberships(user.pgmId);
  }
}
