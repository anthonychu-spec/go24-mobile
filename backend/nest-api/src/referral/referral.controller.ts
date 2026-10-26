import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedUser } from '../auth/jwt.strategy';
import { ReferralService } from './referral.service';
import { Banner } from './entities/banner.entity';
import { RequiresFeature } from '../brand/brand-feature.guard';

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
  @RequiresFeature('referral')
  @Get('referral/my')
  myReferral(@Req() req: Request) {
    return this.svc.getMyReferral((req.user as AuthedUser).id);
  }

  // Admin listing / banner creation used BROADCAST_SECRET (in a query string, even).
  // Removed; they move to the staff admin page.

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
}
