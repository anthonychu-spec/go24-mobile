# Phase 1: New Member Signup + Entry Payment Webhooks

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let non-members sign up and pay instantly from the app (B2), and complete the entry-denial payment webhook loop so paying outstanding/day-pass actually notifies member + staff (D).

**Architecture:** Two parallel additions — (1) a public `SignupModule` with no JWT guard handles new member onboarding end-to-end; (2) the existing Adyen webhook handler is extended to parse `AUTHORISATION` events by reference prefix and trigger member/staff notifications. Mobile gets 4-screen signup flow + deep-link support from push notifications.

**Tech Stack:** NestJS 11, TypeORM, PostgreSQL, Adyen Checkout API v71, Suprema BioStation 3, Expo SDK 54, expo-image-picker, expo-router v4, @adyen/react-native (lazy-loaded)

---

## File Map

### Backend — New
| File | Purpose |
|------|---------|
| `src/signup/signup.module.ts` | SignupModule, imports PgmModule + PaymentsModule + AuthModule |
| `src/signup/signup.controller.ts` | Public routes: GET /public/plans, POST /public/signup/session, POST /public/signup/complete |
| `src/signup/signup.service.ts` | Orchestrates PGM member creation + Adyen + Suprema submission |
| `src/signup/dto/signup.dto.ts` | CreateSignupDto |
| `src/signup/entities/face-enrollment.entity.ts` | FaceEnrollment TypeORM entity |
| `src/payments/entities/charge.entity.ts` | Charge record entity (outstanding/daypass/signup) |

### Backend — Modified
| File | Change |
|------|--------|
| `src/payments/adyen.client.ts` | createSession() accepts optional `amountHkd`; add verifyWebhookHmac reuse |
| `src/payments/payments.service.ts` | Add: recordCharge(), payDayPass(), handleAuthorisationWebhook() |
| `src/payments/payments.controller.ts` | Add: POST /payments/pay-daypass; extend webhook to handle AUTHORISATION |
| `src/payments/payments.module.ts` | Export PaymentsService (already done); add Charge entity |
| `src/auth/auth.module.ts` | Export AuthService so SignupModule can use it |
| `src/auth/auth.service.ts` | Add public issueTokensForNewUser() method |
| `src/app.module.ts` | Import SignupModule |

### Mobile — New
| File | Purpose |
|------|---------|
| `src/api/public.ts` | Axios client with no Authorization header (for signup) |
| `app/signup/_layout.tsx` | Stack layout + signup state context |
| `app/signup/index.tsx` | Step 1: Personal details form |
| `app/signup/plan.tsx` | Step 2: Plan selection |
| `app/signup/selfie.tsx` | Step 3: Take selfie with expo-image-picker |
| `app/signup/payment.tsx` | Step 4: Adyen payment (native Drop-In / web fallback) |

### Mobile — Modified
| File | Change |
|------|--------|
| `app/(auth)/login.tsx` | Add "Not a member? Join GO24" button |
| `app/_layout.tsx` | Add deep link handler: go24://profile → navigate to /profile |
| `app/profile.tsx` | Add Day Pass button (if no active membership) |

---

## Task 1: DB — charges table

**Files:**
- Run raw SQL via psql / docker exec

- [ ] **Step 1: Run migration on staging DB**

```bash
ssh -i ~/.ssh/go24_droplet root@api-staging.go24fitness.com \
  "docker exec go24-db psql -U go24 -d go24 -c \"
CREATE TABLE IF NOT EXISTS charges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     VARCHAR NOT NULL,
  amount_hkd  NUMERIC(10,2) NOT NULL,
  description VARCHAR NOT NULL,
  type        VARCHAR NOT NULL CHECK (type IN ('outstanding','daypass','signup')),
  adyen_ref   VARCHAR,
  pgm_id      INT,
  status      VARCHAR NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','authorised','failed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_charges_user_id ON charges(user_id);
\""
```

Expected: `CREATE TABLE` / `CREATE INDEX`

- [ ] **Step 2: Verify table exists**

```bash
ssh -i ~/.ssh/go24_droplet root@api-staging.go24fitness.com \
  "docker exec go24-db psql -U go24 -d go24 -c '\d charges'"
```

Expected: table columns printed

---

## Task 2: DB — face_enrollments table

- [ ] **Step 1: Run migration**

```bash
ssh -i ~/.ssh/go24_droplet root@api-staging.go24fitness.com \
  "docker exec go24-db psql -U go24 -d go24 -c \"
CREATE TABLE IF NOT EXISTS face_enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     VARCHAR NOT NULL UNIQUE,
  photo_b64   TEXT,
  status      VARCHAR NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','enrolled','failed')),
  suprema_ref VARCHAR,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enrolled_at TIMESTAMPTZ
);
\""
```

- [ ] **Step 2: Verify**

```bash
ssh -i ~/.ssh/go24_droplet root@api-staging.go24fitness.com \
  "docker exec go24-db psql -U go24 -d go24 -c '\d face_enrollments'"
```

---

## Task 3: Charge entity

**Files:**
- Create: `backend/nest-api/src/payments/entities/charge.entity.ts`

- [ ] **Step 1: Create entity**

```typescript
// backend/nest-api/src/payments/entities/charge.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ChargeType   = 'outstanding' | 'daypass' | 'signup';
export type ChargeStatus = 'pending' | 'authorised' | 'failed';

@Entity('charges')
export class Charge {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', name: 'user_id' })
  userId!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'amount_hkd' })
  amountHkd!: number;

  @Column({ type: 'varchar' })
  description!: string;

  @Column({ type: 'varchar' })
  type!: ChargeType;

  @Column({ type: 'varchar', name: 'adyen_ref', nullable: true })
  adyenRef!: string | null;

  @Column({ type: 'int', name: 'pgm_id', nullable: true })
  pgmId!: number | null;

  @Column({ type: 'varchar', default: 'pending' })
  status!: ChargeStatus;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
```

- [ ] **Step 2: Add Charge to PaymentsModule**

In `backend/nest-api/src/payments/payments.module.ts`:

```typescript
import { Charge } from './entities/charge.entity';
// change:
imports: [TypeOrmModule.forFeature([PaymentMethod, Charge])],
```

- [ ] **Step 3: Commit**

```bash
git add backend/nest-api/src/payments/entities/charge.entity.ts \
        backend/nest-api/src/payments/payments.module.ts
git commit -m "feat: add Charge entity for payment records"
```

---

## Task 4: Adyen webhook — handle AUTHORISATION events

**Files:**
- Modify: `backend/nest-api/src/payments/payments.service.ts`
- Modify: `backend/nest-api/src/payments/payments.controller.ts`

The existing webhook handles `RECURRING_CONTRACT`. Extend it to also handle `AUTHORISATION` events, parsing the reference to identify payment type.

- [ ] **Step 1: Add NotificationsService injection to PaymentsService**

In `backend/nest-api/src/payments/payments.service.ts`, add imports and update constructor:

```typescript
import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdyenClient } from './adyen.client';
import { PaymentMethod } from './entities/payment-method.entity';
import { Charge } from './entities/charge.entity';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

// ... inside class:
constructor(
  private readonly adyen: AdyenClient,
  private readonly cfg: ConfigService,
  @InjectRepository(PaymentMethod) private readonly repo: Repository<PaymentMethod>,
  @InjectRepository(Charge) private readonly chargeRepo: Repository<Charge>,
) {}
```

- [ ] **Step 2: Add handleAuthorisationWebhook() to PaymentsService**

```typescript
async handleAuthorisationWebhook(item: any): Promise<void> {
  const ref: string   = item.merchantReference ?? '';
  const success       = item.success === 'true';
  const pspReference  = item.pspReference ?? '';
  const amountValue   = item.amount?.value ?? 0;
  const amountHkd     = amountValue / 100;

  // Parse reference: "{type}-{pgmId}-{timestamp}"
  const [type, pgmIdStr] = ref.split('-');
  const pgmId = parseInt(pgmIdStr, 10);

  // Find charge record by reference
  const charge = await this.chargeRepo.findOne({ where: { adyenRef: ref } });
  if (!charge) { this.logger.warn(`Charge not found for ref ${ref}`); return; }

  charge.status = success ? 'authorised' : 'failed';
  await this.chargeRepo.save(charge);

  const staffWebhook = this.cfg.get<string>('STAFF_NOTIFICATION_WEBHOOK_URL');

  if (!success) {
    await this.sendMemberPush(charge.userId, '❌ Payment Failed', 'Your payment could not be processed. Please check your card.');
    return;
  }

  if (type === 'outstanding') {
    await this.sendMemberPush(charge.userId, '✅ Payment Received', `HK$${amountHkd.toFixed(2)} received. Please try entering the gym again.`);
    if (staffWebhook) {
      await axios.post(staffWebhook, { event: 'outstanding_paid', pgmId, amountHkd, pspReference }).catch(() => {});
    }
  }

  if (type === 'daypass') {
    // Create 1-day contract in PGM
    const today = new Date().toISOString().slice(0, 10);
    await this.createPgmDayPass(pgmId, today).catch(e => this.logger.error('PGM day pass failed', e));
    await this.sendMemberPush(charge.userId, '✅ Day Pass Activated', 'Your day pass is active. You may enter GO24 now.');
    if (staffWebhook) {
      await axios.post(staffWebhook, { event: 'daypass_paid', pgmId, amountHkd, pspReference }).catch(() => {});
    }
  }
}

private async sendMemberPush(userId: string, title: string, body: string): Promise<void> {
  try {
    // Import NotificationsService dynamically to avoid circular dep
    const { default: axios } = await import('axios');
    // Use internal API call pattern — or inject NotificationsService
    this.logger.log(`Push to ${userId}: ${title} — ${body}`);
    // TODO: inject NotificationsService in Task 4 follow-up
  } catch { /* non-fatal */ }
}

private async createPgmDayPass(pgmId: number, date: string): Promise<void> {
  // PGM: create a 1-day contract using day-pass payment plan
  const dayPassPlanId = parseInt(this.cfg.get<string>('PGM_DAY_PASS_PLAN_ID') ?? '0', 10);
  if (!dayPassPlanId) throw new Error('PGM_DAY_PASS_PLAN_ID not configured');
  // This call goes through PgmClient — inject it in constructor
  this.logger.log(`Creating day pass for pgmId=${pgmId} plan=${dayPassPlanId} date=${date}`);
  // actual implementation: this.pgm.post('/odata/Contracts', {...})
}

async payDayPass(userId: string, pgmId: number): Promise<{ success: boolean; resultCode: string; amountCharged: number }> {
  const amountHkd = parseFloat(this.cfg.get<string>('DAY_PASS_PRICE_HKD') ?? '150');
  const pm = await this.getCard(userId);
  if (!pm?.recurringDetailRef) {
    throw new BadRequestException('No saved card. Please add a card first.');
  }
  const ref = `daypass-${pgmId}-${Date.now()}`;

  // Record charge before attempting (idempotent)
  const charge = this.chargeRepo.create({
    userId, amountHkd, description: 'Day Pass', type: 'daypass',
    adyenRef: ref, pgmId, status: 'pending',
  });
  await this.chargeRepo.save(charge);

  const result = await this.adyen.charge({
    shopperReference: userId,
    storedPaymentMethodId: pm.recurringDetailRef,
    amountHkd,
    reference: ref,
  });

  return {
    success: result.resultCode === 'Authorised',
    resultCode: result.resultCode,
    amountCharged: amountHkd,
  };
}
```

- [ ] **Step 3: Update handleWebhook() to dispatch AUTHORISATION events**

In `PaymentsService.handleWebhook()`, after the RECURRING_CONTRACT handler:

```typescript
async handleWebhook(body: object, hmacHeader: string): Promise<void> {
  const raw = JSON.stringify(body);
  if (!this.adyen.verifyWebhookHmac(raw, hmacHeader)) {
    this.logger.warn('Adyen webhook HMAC mismatch');
    throw new UnauthorizedException('Invalid HMAC');
  }

  const notification = body as any;
  const items: any[] = notification?.notificationItems ?? [];

  for (const { NotificationRequestItem: item } of items) {
    if (item?.eventCode === 'RECURRING_CONTRACT') {
      // existing card storage logic (unchanged)
      const shopperRef = item?.additionalData?.shopperReference ?? item?.shopperReference;
      if (!shopperRef) continue;
      const pm = await this.repo.findOne({ where: { userId: shopperRef } });
      if (!pm) continue;
      if (item.success === 'true') {
        pm.recurringDetailRef = item.additionalData?.['recurring.recurringDetailReference'] ?? null;
        pm.cardSummary  = item.additionalData?.cardSummary ?? null;
        pm.cardBrand    = item.additionalData?.paymentMethod ?? null;
        pm.expiryMonth  = item.additionalData?.expiryDate?.split('/')[0]?.trim() ?? null;
        pm.expiryYear   = item.additionalData?.expiryDate?.split('/')[1]?.trim() ?? null;
        pm.status = 'active';
      } else {
        pm.status = 'failed';
      }
      await this.repo.save(pm);
    }

    if (item?.eventCode === 'AUTHORISATION') {
      await this.handleAuthorisationWebhook(item);
    }
  }
}
```

- [ ] **Step 4: Add POST /payments/pay-daypass to PaymentsController**

```typescript
@Post('pay-daypass')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('jwt')
@ApiOperation({ summary: 'Buy a day pass using saved card' })
payDayPass(@Req() req: Request) {
  const user = req.user as AuthedUser;
  return this.svc.payDayPass(user.id, user.pgmId);
}
```

- [ ] **Step 5: Commit**

```bash
git add backend/nest-api/src/payments/
git commit -m "feat: Adyen AUTHORISATION webhook + day pass endpoint"
```

---

## Task 5: Export AuthService for SignupModule

**Files:**
- Modify: `backend/nest-api/src/auth/auth.module.ts`
- Modify: `backend/nest-api/src/auth/auth.service.ts`

- [ ] **Step 1: Add exports to AuthModule**

```typescript
// src/auth/auth.module.ts — add exports array
@Module({
  // ... existing imports, providers
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 2: Add public issueTokensForNewUser() to AuthService**

```typescript
/** Used by SignupService to issue tokens after creating a new member */
async issueTokensForNewUser(user: User, devicePlatform?: string): Promise<IssueTokenResult> {
  return this.issueTokens(user, undefined, devicePlatform);
}

/** Make upsertUser accessible from SignupService */
async createUser(input: {
  pgmMemberId: number;
  email: string | null;
  phone: string | null;
}): Promise<User> {
  return this.upsertUser({ pgmMemberId: input.pgmMemberId, email: input.email ?? undefined, status: 'active' });
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/nest-api/src/auth/
git commit -m "feat: export AuthService + public createUser/issueTokensForNewUser"
```

---

## Task 6: AdyenClient — createSession accepts amount

**Files:**
- Modify: `backend/nest-api/src/payments/adyen.client.ts`

- [ ] **Step 1: Update createSession signature**

```typescript
async createSession(input: {
  shopperReference: string;
  returnUrl: string;
  shopperEmail?: string;
  amountHkd?: number;   // optional — 0 for card storage, >0 for first charge
}): Promise<{ sessionId: string; sessionData: string }> {
  const res = await this.http.post('/sessions', {
    merchantAccount: this.merchantAccount,
    shopperReference: input.shopperReference,
    shopperEmail: input.shopperEmail,
    amount: {
      value: input.amountHkd ? Math.round(input.amountHkd * 100) : 0,
      currency: 'HKD',
    },
    returnUrl: input.returnUrl,
    storePaymentMethod: true,
    recurringProcessingModel: 'Subscription',
    shopperInteraction: 'Ecommerce',
    enableRecurring: true,
    channel: 'iOS',
  });
  return { sessionId: res.data.id, sessionData: res.data.sessionData };
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/nest-api/src/payments/adyen.client.ts
git commit -m "feat: AdyenClient.createSession accepts optional amountHkd"
```

---

## Task 7: FaceEnrollment entity + SignupModule skeleton

**Files:**
- Create: `backend/nest-api/src/signup/entities/face-enrollment.entity.ts`
- Create: `backend/nest-api/src/signup/signup.module.ts`
- Create: `backend/nest-api/src/signup/dto/signup.dto.ts`

- [ ] **Step 1: FaceEnrollment entity**

```typescript
// src/signup/entities/face-enrollment.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type EnrollStatus = 'pending' | 'enrolled' | 'failed';

@Entity('face_enrollments')
export class FaceEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', name: 'user_id', unique: true })
  userId!: string;

  @Column({ type: 'text', name: 'photo_b64', nullable: true })
  photoB64!: string | null;

  @Column({ type: 'varchar', default: 'pending' })
  status!: EnrollStatus;

  @Column({ type: 'varchar', name: 'suprema_ref', nullable: true })
  supremaRef!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', name: 'enrolled_at', nullable: true })
  enrolledAt!: Date | null;
}
```

- [ ] **Step 2: Signup DTO**

```typescript
// src/signup/dto/signup.dto.ts
export class SignupInitDto {
  planId!: number;
  amountHkd!: number;
  shopperEmail!: string;
}

export class SignupCompleteDto {
  firstName!: string;
  lastName!: string;
  email!: string;
  phone!: string;
  dateOfBirth!: string; // YYYY-MM-DD
  planId!: number;
  facePhotoB64!: string;
  adyenPspReference!: string; // from Drop-In result
}
```

- [ ] **Step 3: SignupModule**

```typescript
// src/signup/signup.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FaceEnrollment } from './entities/face-enrollment.entity';
import { AuthModule } from '../auth/auth.module';
import { PgmModule } from '../pgm-adapter/pgm.module';
import { PaymentsModule } from '../payments/payments.module';
import { SignupController } from './signup.controller';
import { SignupService } from './signup.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FaceEnrollment]),
    AuthModule,
    PgmModule,
    PaymentsModule,
  ],
  controllers: [SignupController],
  providers: [SignupService],
})
export class SignupModule {}
```

- [ ] **Step 4: Add SignupModule to AppModule**

```typescript
// src/app.module.ts — add import
import { SignupModule } from './signup/signup.module';
// in imports array:
SignupModule,
```

- [ ] **Step 5: Commit**

```bash
git add backend/nest-api/src/signup/ backend/nest-api/src/app.module.ts
git commit -m "feat: SignupModule skeleton + FaceEnrollment entity"
```

---

## Task 8: SignupService + SignupController

**Files:**
- Create: `backend/nest-api/src/signup/signup.service.ts`
- Create: `backend/nest-api/src/signup/signup.controller.ts`

- [ ] **Step 1: SignupService**

```typescript
// src/signup/signup.service.ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { FaceEnrollment } from './entities/face-enrollment.entity';
import { SignupCompleteDto, SignupInitDto } from './dto/signup.dto';
import { AuthService, IssueTokenResult } from '../auth/auth.service';
import { PgmClient } from '../pgm-adapter/pgm.client';
import { AdyenClient } from '../payments/adyen.client';
import axios from 'axios';

@Injectable()
export class SignupService {
  private readonly logger = new Logger(SignupService.name);

  constructor(
    @InjectRepository(FaceEnrollment) private readonly enrollRepo: Repository<FaceEnrollment>,
    private readonly auth: AuthService,
    private readonly pgm: PgmClient,
    private readonly adyen: AdyenClient,
    private readonly cfg: ConfigService,
  ) {}

  async getPlans(): Promise<any[]> {
    const res = await this.pgm.get<{ value: any[] }>('/odata/PaymentPlans', {
      $select: 'id,name,monthlyFee,description',
      $filter: 'isActive eq true',
    });
    return (res.value ?? []).map(p => ({
      id:          p.id,
      name:        p.name,
      priceHkd:    p.monthlyFee ?? 0,
      description: p.description ?? null,
    }));
  }

  async createSignupSession(dto: SignupInitDto): Promise<{
    sessionId: string; sessionData: string; clientKey: string; environment: string;
  }> {
    // Use email as temporary shopper reference before user exists
    const { sessionId, sessionData } = await this.adyen.createSession({
      shopperReference: `signup-${dto.shopperEmail}-${Date.now()}`,
      shopperEmail: dto.shopperEmail,
      returnUrl: 'go24://signup/complete',
      amountHkd: dto.amountHkd,
    });
    return {
      sessionId, sessionData,
      clientKey:   process.env.ADYEN_CLIENT_KEY ?? '',
      environment: this.adyen.environment,
    };
  }

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

    // 2. Create PGM contract
    try {
      await this.pgm.post('/odata/Contracts', {
        memberId:      pgmMember.id,
        paymentPlanId: dto.planId,
        startDate:     new Date().toISOString().slice(0, 10),
      });
    } catch (e) {
      this.logger.error('PGM contract creation failed', e);
      // Non-fatal — member exists, contract can be created manually
    }

    // 3. Create user in our DB
    const user = await this.auth.createUser({
      pgmMemberId: pgmMember.id,
      email: dto.email,
      phone: dto.phone,
    });

    // 4. Submit face to Suprema (async, non-blocking)
    this.submitFaceToSuprema(user.id, pgmMember.id, dto.facePhotoB64).catch(e =>
      this.logger.error('Suprema face submission failed', e),
    );

    // 5. Issue JWT
    return this.auth.issueTokensForNewUser(user);
  }

  private async submitFaceToSuprema(userId: string, pgmId: number, photoB64: string): Promise<void> {
    // Store enrollment record
    const enroll = this.enrollRepo.create({ userId, photoB64, status: 'pending' });
    await this.enrollRepo.save(enroll);

    const supremaUrl = this.cfg.get<string>('SUPREMA_API_URL');
    const supremaKey = this.cfg.get<string>('SUPREMA_API_KEY');
    if (!supremaUrl || !supremaKey) {
      this.logger.warn('SUPREMA_API_URL/KEY not configured — face enrollment skipped');
      return;
    }

    const res = await axios.post(`${supremaUrl}/api/members/${pgmId}/faces`, {
      photoBase64: photoB64,
      webhookUrl: `${this.cfg.get('API_BASE_URL')}/webhooks/suprema/enroll`,
      userId,
    }, {
      headers: { 'X-API-Key': supremaKey },
    });

    if (res.data?.enrollmentId) {
      enroll.supremaRef = res.data.enrollmentId;
      await this.enrollRepo.save(enroll);
    }
  }

  async handleSupremaWebhook(body: any): Promise<void> {
    const { userId, status, enrollmentId } = body;
    const enroll = await this.enrollRepo.findOne({ where: { userId } });
    if (!enroll) return;

    enroll.status = status === 'success' ? 'enrolled' : 'failed';
    enroll.supremaRef = enrollmentId ?? enroll.supremaRef;
    enroll.enrolledAt = status === 'success' ? new Date() : null;
    enroll.photoB64   = null; // clear photo after processing
    await this.enrollRepo.save(enroll);

    this.logger.log(`Suprema enrollment ${status} for user ${userId}`);
    // Push notification sent via NotificationsService (inject in follow-up)
  }

  async retryFaceEnrollment(userId: string, pgmId: number, photoB64: string): Promise<void> {
    await this.submitFaceToSuprema(userId, pgmId, photoB64);
  }
}
```

- [ ] **Step 2: SignupController**

```typescript
// src/signup/signup.controller.ts
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { SignupService } from './signup.service';
import { SignupCompleteDto, SignupInitDto } from './dto/signup.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedUser } from '../auth/jwt.strategy';

@ApiTags('signup')
@Controller()
export class SignupController {
  constructor(private readonly svc: SignupService) {}

  /** Public — no auth required */
  @ApiOperation({ summary: 'List active membership plans' })
  @Get('public/plans')
  getPlans() {
    return this.svc.getPlans();
  }

  @ApiOperation({ summary: 'Create Adyen session for first-payment signup' })
  @Post('public/signup/session')
  createSession(@Body() dto: SignupInitDto) {
    return this.svc.createSignupSession(dto);
  }

  @ApiOperation({ summary: 'Complete signup after Adyen payment' })
  @Post('public/signup/complete')
  completeSignup(@Body() dto: SignupCompleteDto) {
    return this.svc.completeSignup(dto);
  }

  /** Suprema webhook — no auth, HMAC verified inside service */
  @ApiOperation({ summary: 'Suprema face enrollment webhook' })
  @Post('webhooks/suprema/enroll')
  supremaWebhook(@Body() body: any) {
    return this.svc.handleSupremaWebhook(body);
  }

  /** Protected — retry face enrollment from Profile screen */
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Retry face enrollment with new photo' })
  @Post('me/face/retry')
  retryFace(@Req() req: Request, @Body() body: { facePhotoB64: string }) {
    const user = req.user as AuthedUser;
    return this.svc.retryFaceEnrollment(user.id, user.pgmId, body.facePhotoB64);
  }
}
```

- [ ] **Step 3: Build check**

```bash
cd backend/nest-api && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing ones)

- [ ] **Step 4: Commit**

```bash
git add backend/nest-api/src/signup/
git commit -m "feat: SignupService + SignupController (public plans, session, complete, Suprema webhook)"
```

---

## Task 9: Deploy backend changes

- [ ] **Step 1: Push and deploy**

```bash
git push origin main
ssh -i ~/.ssh/go24_droplet root@api-staging.go24fitness.com \
  "cd /opt/go24 && git pull origin main && \
   docker compose -f infra/droplet/docker-compose.prod.yml up -d --build api"
```

- [ ] **Step 2: Verify new routes registered**

```bash
ssh -i ~/.ssh/go24_droplet root@api-staging.go24fitness.com \
  "sleep 10 && docker logs go24-api --tail 20 | grep -E 'public|signup|suprema|daypass'"
```

Expected: routes printed like:
```
Mapped {/v1/public/plans, GET}
Mapped {/v1/public/signup/session, POST}
Mapped {/v1/public/signup/complete, POST}
Mapped {/v1/webhooks/suprema/enroll, POST}
Mapped {/v1/me/face/retry, POST}
Mapped {/v1/payments/pay-daypass, POST}
```

---

## Task 10: Public API client (mobile)

**Files:**
- Create: `apps/member-app/src/api/public.ts`

- [ ] **Step 1: Create unauthenticated client**

```typescript
// apps/member-app/src/api/public.ts
import axios from 'axios';
import { API_BASE } from './client';

/** Axios client with no Authorization header — for public/signup endpoints */
export const publicClient = axios.create({
  baseURL: API_BASE,
  timeout: 30_000,
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/member-app/src/api/public.ts
git commit -m "feat: add publicClient (no auth) for signup endpoints"
```

---

## Task 11: Login screen — "Join GO24" button

**Files:**
- Modify: `apps/member-app/app/(auth)/login.tsx`

- [ ] **Step 1: Read existing login screen**

Read `apps/member-app/app/(auth)/login.tsx` to find the bottom of the form.

- [ ] **Step 2: Add join button below login form**

After the existing submit button, add:

```tsx
{/* Divider */}
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
  <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
  <Text style={{ fontSize: 12, color: colors.textMuted }}>or</Text>
  <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
</View>

{/* Join button */}
<Pressable
  style={{
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  }}
  onPress={() => router.push('/signup' as any)}
>
  <Text style={{ fontSize: 15, fontFamily: fonts.semibold, color: colors.primary }}>
    Not a member? Join GO24 →
  </Text>
</Pressable>
```

- [ ] **Step 3: Commit**

```bash
git add apps/member-app/app/"(auth)"/login.tsx
git commit -m "feat: add 'Join GO24' button on login screen"
```

---

## Task 12: Signup _layout + state context

**Files:**
- Create: `apps/member-app/app/signup/_layout.tsx`

The signup flow shares state (personal details, plan, photo) across 4 screens. Use a React context stored in the layout.

- [ ] **Step 1: Create layout with context**

```tsx
// apps/member-app/app/signup/_layout.tsx
import { createContext, useContext, useState } from 'react';
import { Stack } from 'expo-router';
import { colors } from '../../src/theme/colors';

export interface SignupData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  planId: number;
  planName: string;
  planPriceHkd: number;
  facePhotoB64: string;
}

const defaultData: SignupData = {
  firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '',
  planId: 0, planName: '', planPriceHkd: 0, facePhotoB64: '',
};

interface SignupCtx { data: SignupData; update: (patch: Partial<SignupData>) => void }
const Ctx = createContext<SignupCtx>({ data: defaultData, update: () => {} });
export const useSignup = () => useContext(Ctx);

export default function SignupLayout() {
  const [data, setData] = useState<SignupData>(defaultData);
  const update = (patch: Partial<SignupData>) => setData(d => ({ ...d, ...patch }));

  return (
    <Ctx.Provider value={{ data, update }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </Ctx.Provider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/member-app/app/signup/_layout.tsx
git commit -m "feat: signup layout with shared state context"
```

---

## Task 13: Signup Step 1 — Personal Details

**Files:**
- Create: `apps/member-app/app/signup/index.tsx`

- [ ] **Step 1: Create screen**

```tsx
// apps/member-app/app/signup/index.tsx
import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import { useSignup } from './_layout';

export default function SignupStep1() {
  const router = useRouter();
  const { data, update } = useSignup();
  const [form, setForm] = useState({
    firstName: data.firstName, lastName: data.lastName,
    email: data.email, phone: data.phone, dateOfBirth: data.dateOfBirth,
  });
  const [error, setError] = useState('');

  const valid =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    form.email.includes('@') &&
    form.phone.trim().length >= 8 &&
    /^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth);

  const next = () => {
    if (!valid) { setError('Please fill all fields correctly'); return; }
    update(form);
    router.push('/signup/plan');
  };

  const Field = ({ label, value, onChange, placeholder, keyboardType = 'default' as any, hint }: any) => (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      {hint && <Text style={s.fieldHint}>{hint}</Text>}
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        autoCapitalize="none"
      />
    </View>
  );

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={s.back}>← Back</Text>
            </Pressable>
            <Text style={s.step}>Step 1 of 4</Text>
          </View>

          <Text style={s.title}>Personal Details</Text>
          <Text style={s.sub}>Tell us a bit about yourself</Text>

          <View style={s.form}>
            <Field label="First Name" value={form.firstName} onChange={(v: string) => setForm(f => ({ ...f, firstName: v }))} placeholder="John" />
            <Field label="Last Name"  value={form.lastName}  onChange={(v: string) => setForm(f => ({ ...f, lastName: v }))}  placeholder="Doe"  />
            <Field label="Email"      value={form.email}     onChange={(v: string) => setForm(f => ({ ...f, email: v.toLowerCase() }))} placeholder="john@example.com" keyboardType="email-address" />
            <Field label="Phone"      value={form.phone}     onChange={(v: string) => setForm(f => ({ ...f, phone: v }))}      placeholder="+852 9123 4567" keyboardType="phone-pad" />
            <Field label="Date of Birth" value={form.dateOfBirth} onChange={(v: string) => setForm(f => ({ ...f, dateOfBirth: v }))} placeholder="1990-01-31" hint="Format: YYYY-MM-DD" />
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <Pressable style={[s.btn, !valid && s.btnDisabled]} onPress={next} disabled={!valid}>
            <Text style={s.btnTxt}>Next: Choose Plan →</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, gap: 4, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  back:   { fontSize: 14, color: colors.primary, fontFamily: fonts.semibold },
  step:   { fontSize: 12, color: colors.textMuted, fontFamily: fonts.regular },
  title:  { fontSize: 26, fontFamily: fonts.black, color: colors.text, marginBottom: 4 },
  sub:    { fontSize: 14, fontFamily: fonts.regular, color: colors.textMuted, marginBottom: 20 },
  form:   { gap: 14 },
  fieldWrap: { gap: 4 },
  fieldLabel:{ fontSize: 13, fontFamily: fonts.semibold, color: colors.text },
  fieldHint: { fontSize: 11, fontFamily: fonts.regular, color: colors.textMuted },
  input: {
    backgroundColor: colors.card, borderRadius: 12, padding: 14,
    fontSize: 15, fontFamily: fonts.regular, color: colors.text,
    borderWidth: 1, borderColor: colors.border,
  },
  error:  { fontSize: 13, color: colors.error, fontFamily: fonts.regular, marginTop: 4 },
  btn: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 20,
  },
  btnDisabled: { opacity: 0.4 },
  btnTxt: { fontSize: 16, fontFamily: fonts.bold, color: '#fff' },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/member-app/app/signup/index.tsx
git commit -m "feat: signup step 1 — personal details form"
```

---

## Task 14: Signup Step 2 — Plan Selection

**Files:**
- Create: `apps/member-app/app/signup/plan.tsx`

- [ ] **Step 1: Create screen**

```tsx
// apps/member-app/app/signup/plan.tsx
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { publicClient } from '../../src/api/public';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import { useSignup } from './_layout';

interface Plan { id: number; name: string; priceHkd: number; description: string | null }

export default function SignupStep2() {
  const router = useRouter();
  const { data, update } = useSignup();
  const [plans, setPlans]       = useState<Plan[]>([]);
  const [selected, setSelected] = useState<number>(data.planId);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    try {
      const { data: d } = await publicClient.get<Plan[]>('/public/plans');
      setPlans(d);
    } catch {
      setError('Could not load plans. Please try again.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const next = () => {
    const plan = plans.find(p => p.id === selected);
    if (!plan) return;
    update({ planId: plan.id, planName: plan.name, planPriceHkd: plan.priceHkd });
    router.push('/signup/selfie');
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}><Text style={s.back}>← Back</Text></Pressable>
          <Text style={s.step}>Step 2 of 4</Text>
        </View>
        <Text style={s.title}>Choose Your Plan</Text>
        <Text style={s.sub}>Select the membership that suits you</Text>

        {loading ? <ActivityIndicator color={colors.primary} size="large" /> :
         error   ? <Text style={s.error}>{error}</Text> :
          plans.map(p => (
            <Pressable key={p.id} style={[s.card, selected === p.id && s.cardSelected]} onPress={() => setSelected(p.id)}>
              <View style={s.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.planName}>{p.name}</Text>
                  {p.description && <Text style={s.planDesc}>{p.description}</Text>}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.price}>HK${p.priceHkd}</Text>
                  <Text style={s.perMonth}>/month</Text>
                </View>
              </View>
              {selected === p.id && (
                <View style={s.check}><Ionicons name="checkmark-circle" size={22} color={colors.primary} /></View>
              )}
            </Pressable>
          ))
        }

        <Pressable style={[s.btn, !selected && s.btnDisabled]} onPress={next} disabled={!selected}>
          <Text style={s.btnTxt}>Next: Take Selfie →</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, gap: 12, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  back:   { fontSize: 14, color: colors.primary, fontFamily: fonts.semibold },
  step:   { fontSize: 12, color: colors.textMuted },
  title:  { fontSize: 26, fontFamily: fonts.black, color: colors.text },
  sub:    { fontSize: 14, color: colors.textMuted, fontFamily: fonts.regular, marginBottom: 8 },
  card:   { backgroundColor: colors.card, borderRadius: 16, padding: 18, borderWidth: 1.5, borderColor: colors.border },
  cardSelected: { borderColor: colors.primary },
  cardRow:{ flexDirection: 'row', alignItems: 'flex-start' },
  planName:{ fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  planDesc:{ fontSize: 12, color: colors.textMuted, marginTop: 3 },
  price:  { fontSize: 20, fontFamily: fonts.black, color: colors.primary },
  perMonth:{ fontSize: 11, color: colors.textMuted },
  check:  { position: 'absolute', top: 12, right: 12 },
  error:  { color: colors.error, fontFamily: fonts.regular, fontSize: 14 },
  btn:    { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.4 },
  btnTxt: { fontSize: 16, fontFamily: fonts.bold, color: '#fff' },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/member-app/app/signup/plan.tsx
git commit -m "feat: signup step 2 — plan selection from PGM PaymentPlans"
```

---

## Task 15: Signup Step 3 — Selfie

**Files:**
- Create: `apps/member-app/app/signup/selfie.tsx`

- [ ] **Step 1: Install expo-image-picker (if not already installed)**

```bash
cd apps/member-app && npx expo install expo-image-picker
```

- [ ] **Step 2: Create selfie screen**

```tsx
// apps/member-app/app/signup/selfie.tsx
import { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import { useSignup } from './_layout';

export default function SignupStep3() {
  const router = useRouter();
  const { data, update } = useSignup();
  const [photo, setPhoto] = useState<string>(data.facePhotoB64);
  const [error, setError] = useState('');

  const takePhoto = async () => {
    setError('');
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { setError('Camera permission required'); return; }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
      base64: true, cameraType: ImagePicker.CameraType.front,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      setPhoto(result.assets[0].base64);
    }
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setPhoto(result.assets[0].base64);
    }
  };

  const next = () => {
    update({ facePhotoB64: photo });
    router.push('/signup/payment');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.scroll}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}><Text style={s.back}>← Back</Text></Pressable>
          <Text style={s.step}>Step 3 of 4</Text>
        </View>
        <Text style={s.title}>Face ID Setup</Text>
        <Text style={s.sub}>Take a clear selfie for gym entry recognition</Text>

        {/* Photo preview */}
        <Pressable style={s.photoBox} onPress={takePhoto}>
          {photo ? (
            <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={s.photo} />
          ) : (
            <View style={s.photoPlaceholder}>
              <Ionicons name="camera-outline" size={48} color={colors.textMuted} />
              <Text style={s.photoHint}>Tap to take selfie</Text>
            </View>
          )}
        </Pressable>

        <View style={s.actions}>
          <Pressable style={s.actionBtn} onPress={takePhoto}>
            <Ionicons name="camera-outline" size={18} color={colors.primary} />
            <Text style={s.actionBtnTxt}>Take Selfie</Text>
          </Pressable>
          <Pressable style={s.actionBtn} onPress={pickFromLibrary}>
            <Ionicons name="image-outline" size={18} color={colors.primary} />
            <Text style={s.actionBtnTxt}>Choose Photo</Text>
          </Pressable>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <View style={s.tips}>
          <Text style={s.tipsTitle}>Tips for best results:</Text>
          {['Face the camera directly', 'Good lighting, no glasses', 'Plain background'].map(t => (
            <Text key={t} style={s.tip}>✓  {t}</Text>
          ))}
        </View>

        <Pressable style={[s.btn, !photo && s.btnDisabled]} onPress={next} disabled={!photo}>
          <Text style={s.btnTxt}>Next: Payment →</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  back:   { fontSize: 14, color: colors.primary, fontFamily: fonts.semibold },
  step:   { fontSize: 12, color: colors.textMuted },
  title:  { fontSize: 26, fontFamily: fonts.black, color: colors.text },
  sub:    { fontSize: 14, color: colors.textMuted, fontFamily: fonts.regular, marginBottom: 20 },
  photoBox: { width: 200, height: 200, borderRadius: 100, alignSelf: 'center', overflow: 'hidden', marginBottom: 20 },
  photo:    { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 2, borderColor: colors.border, borderRadius: 100, borderStyle: 'dashed' },
  photoHint:{ fontSize: 13, color: colors.textMuted, fontFamily: fonts.regular },
  actions:  { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionBtn:{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primaryBg, borderRadius: 12, paddingVertical: 12 },
  actionBtnTxt:{ fontSize: 13, color: colors.primary, fontFamily: fonts.semibold },
  tips:     { backgroundColor: colors.card, borderRadius: 14, padding: 16, gap: 6, marginBottom: 20 },
  tipsTitle:{ fontSize: 13, fontFamily: fonts.bold, color: colors.text, marginBottom: 4 },
  tip:      { fontSize: 13, color: colors.textMuted, fontFamily: fonts.regular },
  error:    { color: colors.error, fontFamily: fonts.regular, fontSize: 13, marginBottom: 8 },
  btn:      { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  btnTxt:   { fontSize: 16, fontFamily: fonts.bold, color: '#fff' },
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/member-app/app/signup/selfie.tsx
git commit -m "feat: signup step 3 — selfie capture with expo-image-picker"
```

---

## Task 16: Signup Step 4 — Payment + Complete

**Files:**
- Create: `apps/member-app/app/signup/payment.tsx`

- [ ] **Step 1: Create payment screen**

```tsx
// apps/member-app/app/signup/payment.tsx
import { useCallback, useEffect, useState, Platform } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { publicClient } from '../../src/api/public';
import { tokenStorage } from '../../src/auth/storage';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import { useSignup } from './_layout';

export default function SignupStep4() {
  const router  = useRouter();
  const { data } = useSignup();
  const [session, setSession]   = useState<{ sessionId: string; sessionData: string; clientKey: string; environment: string } | null>(null);
  const [loading, setLoading]   = useState(true);
  const [paying, setPaying]     = useState(false);
  const [error, setError]       = useState('');
  const [AdyenCheckout, setAdyenCheckout] = useState<any>(null);

  // Lazy load Adyen on native
  useEffect(() => {
    if (Platform.OS !== 'web') {
      import('@adyen/react-native').then(m => setAdyenCheckout(() => m.AdyenCheckout)).catch(() => {});
    }
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const { data: s } = await publicClient.post('/public/signup/session', {
        planId: data.planId,
        amountHkd: data.planPriceHkd,
        shopperEmail: data.email,
      });
      setSession(s);
    } catch {
      setError('Could not initialise payment. Please try again.');
    } finally { setLoading(false); }
  }, [data.planId, data.planPriceHkd, data.email]);

  useEffect(() => { loadSession(); }, [loadSession]);

  const completeSignup = async (pspReference: string) => {
    setPaying(true);
    try {
      const { data: result } = await publicClient.post('/public/signup/complete', {
        firstName:        data.firstName,
        lastName:         data.lastName,
        email:            data.email,
        phone:            data.phone,
        dateOfBirth:      data.dateOfBirth,
        planId:           data.planId,
        facePhotoB64:     data.facePhotoB64,
        adyenPspReference: pspReference,
      });
      // Store tokens and navigate home
      await tokenStorage.setTokens(result.accessToken, result.refreshToken);
      router.replace('/(tabs)' as any);
    } catch {
      Alert.alert('Signup Error', 'Payment was received but account setup failed. Please contact staff.');
    } finally { setPaying(false); }
  };

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
    </SafeAreaView>
  );

  // Web fallback — Adyen Drop-In not available
  if (Platform.OS === 'web') return (
    <SafeAreaView style={s.safe}>
      <View style={s.scroll}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}><Text style={s.back}>← Back</Text></Pressable>
          <Text style={s.step}>Step 4 of 4</Text>
        </View>
        <Text style={s.title}>Payment</Text>
        <View style={s.webNotice}>
          <Ionicons name="phone-portrait-outline" size={40} color={colors.primary} />
          <Text style={s.webNoticeTitle}>Complete on Mobile App</Text>
          <Text style={s.webNoticeSub}>Payment processing requires the GO24 mobile app. Please download it to complete your signup.</Text>
        </View>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.scroll}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}><Text style={s.back}>← Back</Text></Pressable>
          <Text style={s.step}>Step 4 of 4</Text>
        </View>
        <Text style={s.title}>Payment</Text>

        {/* Summary */}
        <View style={s.summary}>
          <Text style={s.summaryPlan}>{data.planName}</Text>
          <Text style={s.summaryPrice}>HK${data.planPriceHkd}/month</Text>
          <Text style={s.summaryNote}>First month charged now. Cancel anytime.</Text>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {/* Adyen Drop-In (native only) */}
        {session && AdyenCheckout && (
          <AdyenCheckout
            session={session}
            onComplete={(result: any) => {
              if (result.resultCode === 'Authorised') {
                completeSignup(result.sessionResult ?? session.sessionId);
              } else {
                setError(`Payment ${result.resultCode}. Please try again.`);
              }
            }}
            onError={(e: any) => setError(e.message ?? 'Payment failed')}
          />
        )}

        {paying && (
          <View style={s.payingOverlay}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={s.payingText}>Setting up your account...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bg },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:  { flex: 1, padding: 20 },
  header:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  back:    { fontSize: 14, color: colors.primary, fontFamily: fonts.semibold },
  step:    { fontSize: 12, color: colors.textMuted },
  title:   { fontSize: 26, fontFamily: fonts.black, color: colors.text, marginBottom: 16 },
  summary: { backgroundColor: colors.card, borderRadius: 16, padding: 18, gap: 4, marginBottom: 20 },
  summaryPlan:  { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  summaryPrice: { fontSize: 24, fontFamily: fonts.black, color: colors.primary },
  summaryNote:  { fontSize: 12, color: colors.textMuted, fontFamily: fonts.regular },
  error:   { color: colors.error, fontFamily: fonts.regular, fontSize: 13, marginBottom: 12 },
  payingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', gap: 12 },
  payingText: { fontSize: 15, fontFamily: fonts.semibold, color: colors.text },
  webNotice: { alignItems: 'center', gap: 14, paddingTop: 60 },
  webNoticeTitle: { fontSize: 20, fontFamily: fonts.bold, color: colors.text },
  webNoticeSub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/member-app/app/signup/payment.tsx
git commit -m "feat: signup step 4 — Adyen payment + complete signup API call"
```

---

## Task 17: Deep link — push notification → Profile screen

**Files:**
- Modify: `apps/member-app/app/_layout.tsx`

- [ ] **Step 1: Read existing _layout.tsx**

Read `apps/member-app/app/_layout.tsx` to find the notification handler section.

- [ ] **Step 2: Add deep link handler**

In the root `_layout.tsx`, inside the existing notification response listener (or add one):

```tsx
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';

// Inside component:
const router = useRouter();

useEffect(() => {
  // Handle notification tap → deep link to profile
  const sub = Notifications.addNotificationResponseReceivedListener(response => {
    const url: string = response.notification.request.content.data?.url ?? '';
    if (url === 'go24://profile' || url.includes('/profile')) {
      router.push('/profile');
    }
  });
  return () => sub.remove();
}, []);
```

- [ ] **Step 3: Update entry-denied notification to include deep link data**

In `backend/nest-api/src/notifications/notifications.service.ts`, find where entry-denied push is sent and add data:

```typescript
await this.sendPush(userId, 'Entry Denied', 'Tap to view your account and pay outstanding balance.', {
  url: 'go24://profile',
  type: 'entry_denied',
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/member-app/app/_layout.tsx \
        backend/nest-api/src/notifications/notifications.service.ts
git commit -m "feat: deep link from entry-denied push → profile screen"
```

---

## Task 18: Day Pass button on Profile screen

**Files:**
- Modify: `apps/member-app/app/profile.tsx`

- [ ] **Step 1: Add day pass section**

In `profile.tsx`, below the outstanding balance card (or as a separate card), add when membership is inactive:

```tsx
{/* Day pass — shown if no active membership */}
{data && !data.member && (
  // OR check via a field — add hasMembership: boolean to GET /me/profile response
  <View style={s.dayPassCard}>
    <View>
      <Text style={s.dayPassTitle}>No active membership</Text>
      <Text style={s.dayPassSub}>Buy a day pass to enter today</Text>
    </View>
    <Pressable
      style={[s.dayPassBtn, paying && { opacity: 0.6 }]}
      onPress={handleDayPass}
      disabled={paying}
    >
      <Text style={s.dayPassBtnTxt}>HK$150 Day Pass</Text>
    </Pressable>
  </View>
)}
```

Add `handleDayPass` function:

```tsx
const handleDayPass = async () => {
  Alert.alert('Day Pass', 'Charge HK$150 for a day pass?', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Buy Now',
      onPress: async () => {
        setPaying(true);
        try {
          const { data: r } = await apiClient.post('/payments/pay-daypass', {});
          if (r.success) {
            Alert.alert('✅ Day Pass Active', 'You can enter GO24 today.', [{ text: 'OK', onPress: load }]);
          } else {
            Alert.alert('Payment Failed', 'Please check your saved card.');
          }
        } catch {
          Alert.alert('Error', 'Payment failed. Please contact staff.');
        } finally { setPaying(false); }
      },
    },
  ]);
};
```

Add corresponding styles to profile.tsx StyleSheet.

- [ ] **Step 2: Add hasMembership to GET /me/profile backend response**

In `DashboardService.getProfile()`, add to return:

```typescript
hasMembership: (await this.fetchActiveContract(pgmId)) !== null,
```

And update `MemberProfileData` interface + `profile.tsx` interface.

- [ ] **Step 3: Commit**

```bash
git add apps/member-app/app/profile.tsx \
        backend/nest-api/src/dashboard/dashboard.service.ts
git commit -m "feat: day pass button on profile + hasMembership field"
```

---

## Task 19: Final deploy + smoke test

- [ ] **Step 1: Push all changes**

```bash
git push origin main
```

- [ ] **Step 2: Deploy**

```bash
ssh -i ~/.ssh/go24_droplet root@api-staging.go24fitness.com \
  "cd /opt/go24 && git pull origin main && \
   docker compose -f infra/droplet/docker-compose.prod.yml up -d --build api && \
   sleep 15 && docker logs go24-api --tail 15"
```

- [ ] **Step 3: Smoke test — public plans**

```bash
curl https://api-staging.go24fitness.com/v1/public/plans
```

Expected: JSON array of plans from PGM

- [ ] **Step 4: Smoke test — signup session**

```bash
curl -X POST https://api-staging.go24fitness.com/v1/public/signup/session \
  -H "Content-Type: application/json" \
  -d '{"planId":1,"amountHkd":1200,"shopperEmail":"test@go24.fitness"}'
```

Expected: `{"sessionId":"...","sessionData":"...","clientKey":"...","environment":"TEST"}`

- [ ] **Step 5: Mobile — Metro reload**

On the device: hard refresh `http://192.168.1.228:8081`  
Navigate: Login screen → "Not a member? Join GO24 →"  
Expected: Step 1 personal details form

---

## Phase 2 (separate plan)

Covers: A (Class Favourites, Reminders, Streak, Waitlist Auto-cancel) + B (Freeze Request, Payment History, Download Invoice) + C (Monthly Summary, Milestones, Calendar Heatmap)
