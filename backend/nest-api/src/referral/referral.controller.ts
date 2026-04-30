import {
  Body, Controller, Get, HttpCode, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, IsNull, Or, Repository, MoreThanOrEqual } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedUser } from '../auth/jwt.strategy';
import { ReferralService } from './referral.service';
import { Banner } from './entities/banner.entity';

class CreateBannerDto {
  @IsString() secret: string;
  @IsString() imageUrl: string;
  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() linkUrl?: string;
  @IsOptional() clubIds?: string[];
  @IsNumber() @IsOptional() displayOrder?: number;
  @IsString() @IsOptional() startAt?: string;
  @IsString() @IsOptional() endAt?: string;
}

@ApiTags('referral & banners')
@Controller()
export class ReferralController {
  constructor(
    private readonly svc: ReferralService,
    @InjectRepository(Banner) private readonly bannerRepo: Repository<Banner>,
  ) {}

  // ── Referral ──────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'My referral link + stats' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Get('referral/my')
  myReferral(@Req() req: Request) {
    return this.svc.getMyReferral((req.user as AuthedUser).id);
  }

  @ApiOperation({ summary: 'Admin: list all referrals' })
  @Get('referral/list')
  listReferrals(@Query('secret') secret: string) {
    return this.svc.listReferrals(secret);
  }

  // ── Banners ───────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Get active promotion banners (optionally filter by club)' })
  @Get('banners')
  async getBanners(@Query('club') club?: string) {
    const now = new Date();
    const all = await this.bannerRepo.find({
      where: { active: true },
      order: { displayOrder: 'ASC' },
    });

    return all.filter(b => {
      if (b.startAt && b.startAt > now) return false;
      if (b.endAt   && b.endAt   < now) return false;
      if (club && b.clubIds && !b.clubIds.includes(club)) return false;
      return true;
    });
  }

  @ApiOperation({ summary: 'Admin: create promotion banner (requires secret)' })
  @Post('banners')
  @HttpCode(200)
  async createBanner(@Body() dto: CreateBannerDto) {
    const secret = process.env.BROADCAST_SECRET ?? '';
    if (!secret || dto.secret !== secret) return { error: 'Unauthorized' };

    const banner = this.bannerRepo.create({
      imageUrl: dto.imageUrl,
      title: dto.title ?? null,
      linkUrl: dto.linkUrl ?? null,
      clubIds: dto.clubIds ?? null,
      displayOrder: dto.displayOrder ?? 0,
      startAt: dto.startAt ? new Date(dto.startAt) : null,
      endAt: dto.endAt ? new Date(dto.endAt) : null,
      active: true,
    });
    return this.bannerRepo.save(banner);
  }
}
