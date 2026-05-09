import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
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

  @ApiOperation({ summary: 'Dashboard summary — membership, PT, next class, stats' })
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

  @ApiOperation({ summary: 'Member profile — personal info, outstanding balance, saved card' })
  @Get('profile')
  profile(@Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.getProfile(user.id, user.pgmId);
  }

  @ApiOperation({ summary: 'Charge saved card for outstanding PGM invoices' })
  @Post('pay-outstanding')
  payOutstanding(@Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.payOutstanding(user.id, user.pgmId);
  }
}
