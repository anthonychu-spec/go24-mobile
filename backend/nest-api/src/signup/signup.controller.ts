import { Body, Controller, Get, Headers, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { assertWebhookSecret } from '../common/webhook-secret';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SignupService } from './signup.service';
import { FaceRetryDto, SignupCompleteDto, SignupSessionDto } from './dto/signup.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedUser } from '../auth/jwt.strategy';
import { RequiresFeature } from '../brand/brand-feature.guard';
import { headerBrand } from '../brand/request-brand';

@ApiTags('signup')
@Controller()
export class SignupController {
  constructor(
    private readonly svc: SignupService,
    private readonly cfg: ConfigService,
  ) {}

  // ── Public routes (no JWT guard) ──────────────────────────────────────────

  @ApiOperation({ summary: 'List active membership plans (public)' })
  @RequiresFeature('signup')
  @Get('public/plans')
  getPlans(@Query('clubId') clubId?: string) {
    return this.svc.getPlans(clubId ? Number(clubId) : undefined);
  }

  @ApiOperation({ summary: 'List clubs (public)' })
  @Get('public/clubs')
  getClubs(@Req() req: Request) {
    return this.svc.getClubs(headerBrand(req));
  }

  @ApiOperation({ summary: 'Create Adyen session for signup payment (public)' })
  @RequiresFeature('signup')
  @Post('public/signup/session')
  @HttpCode(200)
  createSession(@Body() dto: SignupSessionDto) {
    return this.svc.createSignupSession(dto);
  }

  @ApiOperation({ summary: 'Complete signup after Adyen payment success (public)' })
  @RequiresFeature('signup')
  @Post('public/signup/complete')
  @HttpCode(200)
  completeSignup(@Body() dto: SignupCompleteDto) {
    return this.svc.completeSignup(dto);
  }

  @ApiOperation({ summary: 'Suprema face enrollment webhook callback (x-webhook-secret = SUPREMA_WEBHOOK_SECRET)' })
  @Post('webhooks/suprema/enroll')
  @HttpCode(200)
  supremaWebhook(@Body() body: any, @Headers('x-webhook-secret') secret: string) {
    assertWebhookSecret('Suprema', this.cfg.get<string>('SUPREMA_WEBHOOK_SECRET'), secret);
    return this.svc.handleSupremaWebhook(body);
  }

  // ── Protected routes ──────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Retry face enrollment with new photo' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @RequiresFeature('signup')
  @Post('me/face/retry')
  @HttpCode(200)
  retryFace(@Req() req: Request, @Body() body: FaceRetryDto) {
    const user = req.user as AuthedUser;
    return this.svc.retryFaceEnrollment(user.id, user.pgmId, body.facePhotoB64);
  }

  @ApiOperation({ summary: 'Get face enrollment status' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @RequiresFeature('signup')
  @Get('me/face/status')
  faceStatus(@Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.getEnrollmentStatus(user.id);
  }
}
