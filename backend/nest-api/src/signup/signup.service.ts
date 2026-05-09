import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { FaceEnrollment } from './entities/face-enrollment.entity';
import { SignupCompleteDto, SignupSessionDto } from './dto/signup.dto';
import { AuthService, IssueTokenResult } from '../auth/auth.service';
import { PgmClient } from '../pgm-adapter/pgm.client';
import { AdyenClient } from '../payments/adyen.client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SignupService {
  private readonly logger = new Logger(SignupService.name);

  constructor(
    @InjectRepository(FaceEnrollment) private readonly enrollRepo: Repository<FaceEnrollment>,
    private readonly auth: AuthService,
    private readonly pgm: PgmClient,
    private readonly adyen: AdyenClient,
    private readonly notifications: NotificationsService,
    private readonly cfg: ConfigService,
  ) {}

  // ── Public plans (no auth) ────────────────────────────────────────────────

  async getPlans(): Promise<Array<{ id: number; name: string; priceHkd: number; description: string | null }>> {
    try {
      const res = await this.pgm.get<{ value: any[] }>('/odata/PaymentPlans', {
        $select: 'id,name,monthlyFee,description',
        $filter: 'isDeleted eq false',
      });
      return (res.value ?? []).map((p: any) => ({
        id:          p.id,
        name:        p.name ?? 'Plan',
        priceHkd:    p.monthlyFee ?? 0,
        description: p.description ?? null,
      }));
    } catch (e) {
      this.logger.error('Failed to fetch plans from PGM', e);
      return [];
    }
  }

  // ── Create Adyen session for first payment ────────────────────────────────

  async createSignupSession(dto: SignupSessionDto): Promise<{
    sessionId: string; sessionData: string; clientKey: string; environment: string;
  }> {
    const tempRef = `signup-${dto.shopperEmail.replace('@', '-')}-${Date.now()}`;
    const { sessionId, sessionData } = await this.adyen.createSession({
      shopperReference: tempRef,
      shopperEmail:     dto.shopperEmail,
      returnUrl:        'go24://signup/complete',
      amountHkd:        dto.amountHkd,
    });
    return {
      sessionId, sessionData,
      clientKey:   process.env.ADYEN_CLIENT_KEY ?? '',
      environment: this.adyen.environment,
    };
  }

  // ── Complete signup after payment ─────────────────────────────────────────

  async completeSignup(dto: SignupCompleteDto): Promise<IssueTokenResult> {
    // 1. Create member in PGM
    let pgmMember: any;
    try {
      pgmMember = await this.pgm.post<any>('/odata/Members', {
        firstName:   dto.firstName,
        lastName:    dto.lastName,
        email:       dto.email,
        phone:       dto.phone,
        dateOfBirth: dto.dateOfBirth,
      });
    } catch (e) {
      this.logger.error('PGM member creation failed', e);
      throw new BadRequestException('Could not create membership. Please contact staff.');
    }

    if (!pgmMember?.id) {
      throw new BadRequestException('PGM did not return a member ID.');
    }

    // 2. Create PGM contract (non-fatal if fails)
    try {
      await this.pgm.post('/odata/Contracts', {
        memberId:      pgmMember.id,
        paymentPlanId: dto.planId,
        startDate:     new Date().toISOString().slice(0, 10),
      });
    } catch (e) {
      this.logger.error('PGM contract creation failed — member exists but no contract', e);
    }

    // 3. Create user in our DB
    const user = await this.auth.createUser({
      pgmMemberId: pgmMember.id,
      email:       dto.email,
      phone:       dto.phone,
    });

    // 4. Submit face to Suprema (async, non-blocking)
    this.submitFaceToSuprema(user.id, pgmMember.id, dto.facePhotoB64).catch(e =>
      this.logger.error('Suprema face submission failed', e),
    );

    // 5. Welcome push
    await this.notifications.sendDirectPush(
      user.id,
      '🎉 Welcome to GO24!',
      'Your membership is active. Your Face ID is being set up — we\'ll notify you when it\'s ready.',
      { type: 'welcome', url: 'go24://home' },
    ).catch(() => {});

    // 6. Issue JWT
    return this.auth.issueTokensForNewUser(user);
  }

  // ── Suprema face enrollment ───────────────────────────────────────────────

  private async submitFaceToSuprema(userId: string, pgmId: number, photoB64: string): Promise<void> {
    // Upsert enrollment record
    let enroll = await this.enrollRepo.findOne({ where: { userId } });
    if (!enroll) {
      enroll = this.enrollRepo.create({ userId, photoB64, status: 'pending' });
    } else {
      enroll.photoB64 = photoB64;
      enroll.status   = 'pending';
      enroll.enrolledAt = null;
    }
    await this.enrollRepo.save(enroll);

    const supremaUrl = this.cfg.get<string>('SUPREMA_API_URL');
    const supremaKey = this.cfg.get<string>('SUPREMA_API_KEY');
    const apiBase    = this.cfg.get<string>('API_BASE_URL') ?? 'https://api-staging.go24fitness.com/v1';

    if (!supremaUrl || !supremaKey) {
      this.logger.warn('SUPREMA_API_URL/KEY not configured — skipping face enrollment');
      return;
    }

    const res = await axios.post(
      `${supremaUrl}/api/members/${pgmId}/faces`,
      {
        photoBase64: photoB64,
        webhookUrl:  `${apiBase}/webhooks/suprema/enroll`,
        userId,
      },
      { headers: { 'X-API-Key': supremaKey }, timeout: 15_000 },
    );

    if (res.data?.enrollmentId) {
      enroll.supremaRef = res.data.enrollmentId;
      await this.enrollRepo.save(enroll);
    }
  }

  // ── Suprema webhook callback ──────────────────────────────────────────────

  async handleSupremaWebhook(body: any): Promise<void> {
    const { userId, status, enrollmentId } = body ?? {};
    if (!userId) return;

    const enroll = await this.enrollRepo.findOne({ where: { userId } });
    if (!enroll) {
      this.logger.warn(`Suprema webhook: no enrollment record for userId ${userId}`);
      return;
    }

    const success = status === 'success';
    enroll.status     = success ? 'enrolled' : 'failed';
    enroll.supremaRef = enrollmentId ?? enroll.supremaRef;
    enroll.enrolledAt = success ? new Date() : null;
    enroll.photoB64   = null; // clear photo after processing
    await this.enrollRepo.save(enroll);

    this.logger.log(`Suprema enrollment ${status} for user ${userId}`);

    await this.notifications.sendDirectPush(
      userId,
      success ? '✅ Face ID Activated' : '❌ Face ID Setup Failed',
      success
        ? 'Your Face ID is ready. You can now enter GO24 by face recognition.'
        : 'Face ID setup failed. Please go to My Account → retake your photo.',
      { type: success ? 'face_enrolled' : 'face_failed', url: 'go24://profile' },
    ).catch(() => {});
  }

  // ── Retry face enrollment ─────────────────────────────────────────────────

  async retryFaceEnrollment(userId: string, pgmId: number, photoB64: string): Promise<{ queued: boolean }> {
    await this.submitFaceToSuprema(userId, pgmId, photoB64);
    return { queued: true };
  }

  // ── Get enrollment status ─────────────────────────────────────────────────

  async getEnrollmentStatus(userId: string): Promise<{ status: string } | null> {
    const enroll = await this.enrollRepo.findOne({ where: { userId } });
    if (!enroll) return null;
    return { status: enroll.status };
  }
}
