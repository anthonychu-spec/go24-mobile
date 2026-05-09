import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedUser } from '../auth/jwt.strategy';
import { MembershipRequestsService } from './membership-requests.service';

@ApiTags('membership')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('me/membership')
export class MembershipRequestsController {
  constructor(private readonly svc: MembershipRequestsService) {}

  @ApiOperation({ summary: 'Submit a freeze request' })
  @Post('freeze-request')
  freeze(
    @Req() req: Request,
    @Body() body: { startDate: string; endDate: string; reason: string },
  ) {
    return this.svc.createFreeze((req.user as AuthedUser).id, body);
  }

  @ApiOperation({ summary: 'List all membership requests' })
  @Get('requests')
  list(@Req() req: Request) {
    return this.svc.listRequests((req.user as AuthedUser).id);
  }
}
