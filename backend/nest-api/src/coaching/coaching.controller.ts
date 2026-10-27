import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedUser } from '../auth/jwt.strategy';
import { RequiresFeature } from '../brand/brand-feature.guard';
import { RateLimit } from '../common/rate-limit';
import { CoachingService } from './coaching.service';

export class CreateEnquiryDto {
  @IsInt() @IsPositive() clubId!: number;
  @IsString() @IsNotEmpty() @MaxLength(500) goal!: string;
  @IsOptional() @IsString() @MaxLength(200) preferredTimes?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

@ApiTags('coaching')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@RequiresFeature('coaching_enquiry')
@Controller('coaching/enquiries')
export class CoachingController {
  constructor(private readonly svc: CoachingService) {}

  @ApiOperation({ summary: 'Ask for a coaching consultation (stored; nobody is contacted automatically yet)' })
  @RateLimit({ limit: 5, windowMs: 60_000, by: 'user' })
  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateEnquiryDto, @Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.create({ ...dto, userId: user.id, pgmMemberId: user.pgmId, brand: user.brand });
  }

  @ApiOperation({ summary: 'My coaching enquiries' })
  @Get()
  list(@Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.listMine(user.id, user.brand);
  }
}
