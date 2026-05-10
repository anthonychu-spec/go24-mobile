import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SignupService } from './signup.service';
import { SignupCompleteDto, SignupSessionDto } from './dto/signup.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedUser } from '../auth/jwt.strategy';

@ApiTags('signup')
@Controller()
export class SignupController {
  constructor(private readonly svc: SignupService) {}

  // ── Public routes (no JWT guard) ──────────────────────────────────────────

  @ApiOperation({ summary: 'List active membership plans (public)' })
  @Get('public/plans')
  getPlans() {
    return this.svc.getPlans();
  }

  @ApiOperation({ summary: 'List clubs (public)' })
  @Get('public/clubs')
  getClubs() {
    return this.svc.getClubs();
  }

  @ApiOperation({ summary: 'Create Adyen session for signup payment (public)' })
  @Post('public/signup/session')
  @HttpCode(200)
  createSession(@Body() dto: SignupSessionDto) {
    return this.svc.createSignupSession(dto);
  }

  @ApiOperation({ summary: 'Complete signup after Adyen payment success (public)' })
  @Post('public/signup/complete')
  @HttpCode(200)
  completeSignup(@Body() dto: SignupCompleteDto) {
    return this.svc.completeSignup(dto);
  }

  @ApiOperation({ summary: 'Suprema face enrollment webhook callback (public)' })
  @Post('webhooks/suprema/enroll')
  @HttpCode(200)
  supremaWebhook(@Body() body: any) {
    return this.svc.handleSupremaWebhook(body);
  }

  // ── Protected routes ──────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Retry face enrollment with new photo' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Post('me/face/retry')
  @HttpCode(200)
  retryFace(@Req() req: Request, @Body() body: { facePhotoB64: string }) {
    const user = req.user as AuthedUser;
    return this.svc.retryFaceEnrollment(user.id, user.pgmId, body.facePhotoB64);
  }

  @ApiOperation({ summary: 'Get face enrollment status' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Get('me/face/status')
  faceStatus(@Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.getEnrollmentStatus(user.id);
  }
}
