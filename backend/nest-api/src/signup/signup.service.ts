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

  async getClubs(): Promise<Array<{ id: number; name: string }>> {
    try {
      const res = await this.pgm.get<{ value: any[] }>('/odata/Clubs', {
        $select: 'id,name',
      });
      return (res.value ?? [])
        .filter((c: any) => !c.name?.includes('_'))
        .map((c: any) => ({ id: c.id, name: c.name }));
    } catch (e) {
      this.logger.error('Failed to fetch clubs', e);
      return [];
    }
  }

  async getPlans(clubId?: number): Promise<Array<{
    id: number; name: string; membershipFee: number;
    joiningFee: number; adminFee: number; description: string | null;
  }>> {
    try {
      const res = await this.pgm.get<{ value: any[] }>('/odata/PaymentPlans', {
        $filter: 'isDeleted eq false and isActive eq true',
      });

      const all = (res.value ?? []).map((p: any) => ({
        id:            p.id,
        name:          p.name as string ?? 'Plan',
        membershipFee: p.membershipFee?.gross ?? 0,
        joiningFee:    p.joiningFee?.gross ?? 0,
        adminFee:      p.adminFee?.gross ?? 0,
        description:   null as string | null,
      }));

      // Filter to online-purchasable plans only, exclude renewal/upgrade plans
      const online = all.filter(p =>
        p.name.includes('Online') &&
        !/(renewal|upgrade)/i.test(p.name)
      );

      if (!clubId) return online;

      // Determine club type from club list
      let clubName = '';
      try {
        const clubs = await this.getClubs();
        clubName = clubs.find(c => c.id === clubId)?.name ?? '';
      } catch { /* fall through — show all online */ }

      if (!clubName) return online;

      const isOnyx = clubName.includes('ONYX');
      const brand  = isOnyx ? 'ONYX' : 'GO24';

      return online.filter(p => {
        const n = p.name.toUpperCase();
        // Keep plans matching club brand
        if (!n.includes(brand)) return false;
        // For Day Pass: only keep club-specific ones where applicable
        if (n.includes('DAY PASS')) {
          // Admiralty club (id 39) → Admiralty Day Pass
          if (clubId === 39) return n.includes('ADMIRALTY');
          // Central club (id 36) → Central Day Pass
          if (clubId === 36) return n.includes('CENTRAL');
          // Other ONYX clubs → generic ONYX Online Day Pass
          if (isOnyx) return n === 'ONYX ONLINE DAY PASS 2026';
          // GO24 clubs → GO24 Online Day Pass
          return n === 'GO24 ONLINE DAY PASS';
        }
        return true;
      });
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
    // 1. Create member in PGM via CQRS command (v2.1)
    let pgmMemberId: number;
    try {
      const res = await this.pgm.post<{ memberId: number }>(
        '../v2.1/Members/AddGuestMember',
        {
          homeClubId: dto.clubId,
          personalData: {
            firstName:   dto.firstName,
            lastName:    dto.lastName,
            sex:         dto.sex || 'NotSpecified',
            phoneNumber: dto.phone,
            email:       dto.email,
          },
          addressData: {
            street: dto.address || '',
          },
        },
      );
      pgmMemberId = res.memberId;
      this.logger.log(`PGM member created: ${pgmMemberId}`);
    } catch (e) {
      this.logger.error('PGM AddGuestMember failed', e);
      throw new BadRequestException('Could not create membership. Please contact staff.');
    }

    // 2. Create contract in PGM (v2.2)
    let contractId: number | null = null;
    try {
      const contractRes = await this.pgm.post<{ contractId?: number; id?: number }>(
        '/Contracts/AddContract',
        {
          memberId:      pgmMemberId,
          paymentPlanId: dto.planId,
          startDate:     dto.startDate || new Date().toISOString().slice(0, 10),
        },
      );
      contractId = contractRes.contractId ?? contractRes.id ?? null;
      this.logger.log(`PGM contract created: ${contractId}`);
    } catch (e) {
      this.logger.error('PGM AddContract failed — member exists but no contract', e);
    }

    // 3. Settle payment in PGM (v2.2)
    if (contractId) {
      try {
        await this.pgm.post('/Transactions/AddContractPayment', {
          vatRateId:       3,
          clubId:          dto.clubId,
          paymentType:     'Online',
          memberId:        pgmMemberId,
          contractId,
          amountGross:     dto.amountHkd ?? 0,
          description:     "go24fitness-hk-Membership Fee, e-provider='Adyen'",
          systemType:      'Membership',
          transactionDate: new Date().toISOString().replace('Z', '+08:00'),
        });
        this.logger.log(`PGM payment settled for contract ${contractId}`);
      } catch (e) {
        this.logger.error('PGM AddContractPayment failed — contract exists but payment not settled', e);
      }
    }

    // 4. Create user in our DB
    const user = await this.auth.createUser({
      pgmMemberId,
      email: dto.email,
      phone: dto.phone,
    });

    // 5. Submit face to Suprema (async, non-blocking)
    this.submitFaceToSuprema(user.id, pgmMemberId, dto.facePhotoB64).catch(e =>
      this.logger.error('Suprema face submission failed', e),
    );

    // 6. Welcome push
    await this.notifications.sendDirectPush(
      user.id,
      '🎉 Welcome to GO24!',
      'Your membership is active. Your Face ID is being set up — we\'ll notify you when it\'s ready.',
      { type: 'welcome', url: 'go24://home' },
    ).catch(() => {});

    // 7. Issue JWT
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
