import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedUser } from '../auth/jwt.strategy';
import { MembershipRequestsService } from './membership-requests.service';
import { RequiresFeature } from '../brand/brand-feature.guard';

class FreezeRequestDto {
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsString() @IsNotEmpty() @MaxLength(500) reason: string;
}

@ApiTags('membership')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@RequiresFeature('freeze')
@Controller('me/membership')
export class MembershipRequestsController {
  constructor(private readonly svc: MembershipRequestsService) {}

  @ApiOperation({ summary: 'Submit a freeze request' })
  @Post('freeze-request')
  freeze(
    @Req() req: Request,
    @Body() body: FreezeRequestDto,
  ) {
    return this.svc.createFreeze((req.user as AuthedUser).id, body);
  }

  @ApiOperation({ summary: 'List all membership requests' })
  @Get('requests')
  list(@Req() req: Request) {
    return this.svc.listRequests((req.user as AuthedUser).id);
  }
}
