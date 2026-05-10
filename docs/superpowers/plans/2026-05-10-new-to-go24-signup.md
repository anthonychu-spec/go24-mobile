# New to GO24 — Landing Page + Sign-up Flow

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native landing page and 4-step sign-up flow that creates a PGM member, assigns a contract, collects Adyen payment, settles in PGM, and auto-logs the user in.

**Architecture:** Login screen links to a marketing landing page. "Join Now" enters a 4-step wizard (Details → Plan → Selfie → Payment) backed by a React Context for cross-step state. On payment success, backend orchestrates PGM member creation → contract → payment settlement → local user → JWT issuance. Existing signup screens exist but need club selection added and backend PGM calls fixed to use the correct CQRS command endpoints.

**Tech Stack:** React Native (Expo SDK 54), expo-router, expo-image-picker, expo-linear-gradient, @adyen/react-native (native-only lazy import), NestJS 11 backend, PGM v2.1/v2.2 CQRS APIs, Adyen Checkout v71.

---

## Verified PGM Endpoints

| Step | Method | URL | Notes |
|------|--------|-----|-------|
| Create member | POST | `/Api/v2.1/Members/AddGuestMember` | Returns `{ memberId }` |
| Create contract | POST | `/Api/v2.2/Contracts/AddContract` | Needs `memberId`, `paymentPlanId`, `startDate` |
| Settle payment | POST | `/Api/v2.2/Transactions/AddContractPayment` | Needs `vatRateId:3`, `clubId`, `paymentType:"Online"`, `memberId`, `contractId`, `amountGross`, `description`, `systemType:"Membership"`, `transactionDate` |

Auth headers: `X-Client-Id` + `X-Client-Secret` (same creds as existing PgmClient).

## PGM Data

- 16 clubs (GO24 Fitness × 9 + ONYX by GO24 × 5 + duplicates)
- PaymentPlans have: `id`, `name`, `isActive`, `membershipFee.gross`, `joiningFee.gross`, `adminFee.gross`, `commitmentPeriod`, `paymentInterval`

## File Map

### Backend (modify)

| File | Responsibility |
|------|----------------|
| `backend/nest-api/src/signup/signup.service.ts` | Fix PGM calls to use correct CQRS endpoints; add club selection; add AddContract + AddContractPayment |
| `backend/nest-api/src/signup/signup.controller.ts` | Add `GET /public/clubs` endpoint |
| `backend/nest-api/src/signup/dto/signup.dto.ts` | Add `clubId`, `sex`, `address` to DTOs |

### Frontend (modify)

| File | Responsibility |
|------|----------------|
| `apps/member-app/app/(auth)/login.tsx` | Update "Join GO24" link to navigate to `/landing` |
| `apps/member-app/app/signup/_layout.tsx` | Add `clubId`, `clubName`, `sex` to SignupData context |
| `apps/member-app/app/signup/index.tsx` | Add club + gender selection; migrate to design system components |
| `apps/member-app/app/signup/plan.tsx` | Show fee breakdown (membership + joining + admin); migrate to design system |
| `apps/member-app/app/signup/selfie.tsx` | Migrate to design system components |
| `apps/member-app/app/signup/payment.tsx` | Migrate to design system; fix `Platform` import |

### Frontend (create)

| File | Responsibility |
|------|----------------|
| `apps/member-app/app/(auth)/landing.tsx` | Marketing landing page with brand hero, features, CTA |
| `apps/member-app/app/signup/success.tsx` | Post-signup success screen with face ID status |

### i18n (modify)

| File | Responsibility |
|------|----------------|
| `apps/member-app/src/i18n/locales/en.ts` | Add landing + signup copy |

---

## Task 1: Backend — Fix PGM signup endpoints

**Files:**
- Modify: `backend/nest-api/src/signup/signup.service.ts`
- Modify: `backend/nest-api/src/signup/signup.controller.ts`
- Modify: `backend/nest-api/src/signup/dto/signup.dto.ts`

- [ ] **Step 1: Update SignupCompleteDto to include clubId, sex, address**

```typescript
// backend/nest-api/src/signup/dto/signup.dto.ts
export class SignupSessionDto {
  planId!: number;
  amountHkd!: number;
  shopperEmail!: string;
}

export class SignupCompleteDto {
  firstName!: string;
  lastName!: string;
  email!: string;
  phone!: string;
  dateOfBirth!: string;
  sex!: string;
  address!: string;
  clubId!: number;
  planId!: number;
  facePhotoB64!: string;
  adyenPspReference!: string;
}
```

- [ ] **Step 2: Add GET /public/clubs to controller**

```typescript
// Add to signup.controller.ts after getPlans()
@ApiOperation({ summary: 'List clubs (public)' })
@Get('public/clubs')
getClubs() {
  return this.svc.getClubs();
}
```

- [ ] **Step 3: Rewrite signup.service.ts with correct PGM CQRS endpoints**

Replace the entire `completeSignup()` method and add `getClubs()`:

```typescript
// In signup.service.ts

async getClubs(): Promise<Array<{ id: number; name: string }>> {
  try {
    const res = await this.pgm.get<{ value: any[] }>('/odata/Clubs', {
      $select: 'id,name',
    });
    return (res.value ?? [])
      .filter((c: any) => !c.name?.includes('_'))  // exclude test clubs like "Wong Tai Sin_eWAPJh9vQc"
      .map((c: any) => ({ id: c.id, name: c.name }));
  } catch (e) {
    this.logger.error('Failed to fetch clubs', e);
    return [];
  }
}

async getPlans(): Promise<Array<{
  id: number; name: string; membershipFee: number;
  joiningFee: number; adminFee: number; description: string | null;
}>> {
  try {
    const res = await this.pgm.get<{ value: any[] }>('/odata/PaymentPlans', {
      $filter: 'isDeleted eq false and isActive eq true',
    });
    return (res.value ?? []).map((p: any) => ({
      id:            p.id,
      name:          p.name ?? 'Plan',
      membershipFee: p.membershipFee?.gross ?? 0,
      joiningFee:    p.joiningFee?.gross ?? 0,
      adminFee:      p.adminFee?.gross ?? 0,
      description:   null,
    }));
  } catch (e) {
    this.logger.error('Failed to fetch plans from PGM', e);
    return [];
  }
}

async completeSignup(dto: SignupCompleteDto): Promise<IssueTokenResult> {
  // 1. Create member in PGM via CQRS command (v2.1)
  let pgmMemberId: number;
  try {
    const res = await this.pgm.post<{ memberId: number }>(
      // NOTE: PgmClient baseURL is /Api/v2.2 — we need v2.1 for this endpoint
      // Use relative path trick: go up one level then into v2.1
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
        startDate:     new Date().toISOString().slice(0, 10),
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
```

- [ ] **Step 4: Add `amountHkd` field to SignupCompleteDto**

The `amountHkd` field is needed for settlement. Add it to the DTO:

```typescript
export class SignupCompleteDto {
  firstName!: string;
  lastName!: string;
  email!: string;
  phone!: string;
  dateOfBirth!: string;
  sex!: string;
  address!: string;
  clubId!: number;
  planId!: number;
  amountHkd!: number;
  facePhotoB64!: string;
  adyenPspReference!: string;
}
```

- [ ] **Step 5: Verify PgmClient can reach v2.1 path**

The PgmClient baseURL is set to PGM_API_BASE which is `https://go24fitness-hk.perfectgym.pl/Api/v2.2`. The `../v2.1/Members/AddGuestMember` relative path trick may not work with axios. Instead, override the URL resolution:

Check `pgm.client.ts` — if the `post()` method passes the path as `url` to axios, a relative `../v2.1/...` should resolve correctly. If not, add a `postAbsolute()` method or modify the path handling.

Test by checking if `axios.create({ baseURL: 'https://example.com/Api/v2.2' }).post('../v2.1/Members/AddGuestMember', {})` resolves to the correct URL. If it doesn't, hardcode the v2.1 base:

```typescript
// In signup.service.ts constructor, add a direct v2.1 client
private readonly pgmV21Base: string;

constructor(/* ... */) {
  // ...
  const base = this.cfg.get<string>('PGM_API_BASE') ?? '';
  this.pgmV21Base = base.replace('/v2.2', '/v2.1');
}

// Then in completeSignup(), replace the PGM member creation:
const res = await axios.post<{ memberId: number }>(
  `${this.pgmV21Base}/Members/AddGuestMember`,
  { homeClubId: dto.clubId, personalData: { ... }, addressData: { ... } },
  {
    headers: {
      'X-Client-Id': this.cfg.get('PGM_CLIENT_ID'),
      'X-Client-Secret': this.cfg.get('PGM_CLIENT_SECRET'),
      'Content-Type': 'application/json',
    },
    timeout: 10_000,
  },
);
```

- [ ] **Step 6: Commit backend changes**

```bash
git add backend/nest-api/src/signup/
git commit -m "fix(signup): use correct PGM CQRS endpoints for member creation, contract, and payment settlement"
```

---

## Task 2: i18n — Add landing + signup copy

**Files:**
- Modify: `apps/member-app/src/i18n/locales/en.ts`

- [ ] **Step 1: Add landing and signup sections**

```typescript
export const en = {
  login: {
    title: 'Welcome back',
    subtitle: 'Sign in to your GO24 account',
    emailLabel: 'Email',
    emailPlaceholder: 'your@email.com',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Password',
    submit: 'Sign In',
    forgotPassword: 'Forgot password?',
    newToGo24: 'New to GO24?',
    joinNow: 'Join Now',
  },
  landing: {
    hero: 'Your Fitness Journey Starts Here',
    heroSub: 'Premium 24/7 gym access across Hong Kong',
    joinNow: 'Join GO24',
    alreadyMember: 'Already a member?',
    signIn: 'Sign In',
    feature1Title: '24/7 Access',
    feature1Desc: 'Train on your schedule — open around the clock',
    feature2Title: 'Face ID Entry',
    feature2Desc: 'Walk in with just your face — no card needed',
    feature3Title: 'Multi-Location',
    feature3Desc: 'Access any GO24 or ONYX club across HK',
    feature4Title: 'Premium Equipment',
    feature4Desc: 'Top-tier machines, free weights, and functional zones',
  },
  signup: {
    step1Title: 'Personal Details',
    step1Sub: 'Tell us about yourself',
    step2Title: 'Choose Your Plan',
    step2Sub: 'Select the membership that suits you',
    step3Title: 'Face ID Setup',
    step3Sub: 'Take a clear selfie for gym entry',
    step4Title: 'Payment',
    stepOf: 'Step {{current}} of 4',
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    phone: 'Phone',
    dateOfBirth: 'Date of Birth',
    dobHint: 'Format: YYYY-MM-DD',
    gender: 'Gender',
    genderMale: 'Male',
    genderFemale: 'Female',
    homeClub: 'Home Club',
    selectClub: 'Select your home club',
    nextPlan: 'Next: Choose Plan',
    nextSelfie: 'Next: Take Selfie',
    nextPayment: 'Next: Payment',
    perMonth: '/month',
    joiningFee: 'Joining fee',
    adminFee: 'Admin fee',
    firstMonth: 'First month charged now',
    cameraTip1: 'Face the camera directly',
    cameraTip2: 'Good lighting, no glasses',
    cameraTip3: 'Plain background',
    tipsTitle: 'Tips for best results:',
    camera: 'Camera',
    gallery: 'Gallery',
    tapToTakeSelfie: 'Tap to take selfie',
    cameraPermRequired: 'Camera permission is required',
    takeSelfieFirst: 'Please take a selfie first',
    fillAllFields: 'Please fill all fields correctly',
    couldNotLoadPlans: 'Could not load plans. Please try again.',
    couldNotLoadClubs: 'Could not load clubs. Please try again.',
    tryAgain: 'Try Again',
    paymentInitError: 'Could not initialise payment. Please try again.',
    paymentDeclined: 'Payment declined. Please try again.',
    paymentFailed: 'Payment failed. Please try again.',
    settingUpAccount: 'Setting up your account…',
    completeOnMobile: 'Complete on Mobile App',
    completeOnMobileSub: 'Payment processing requires the GO24 mobile app.\nPlease download and complete signup there.',
    setupErrorTitle: 'Setup Error',
    setupErrorMsg: 'Payment was received but account setup failed. Please contact staff with your email address.',
    successTitle: 'Welcome to GO24!',
    successSub: 'Your membership is active',
    faceIdPending: 'Face ID is being set up — we\'ll notify you when ready.',
    goToHome: 'Start Training',
  },
  errors: {
    invalidCredentials: 'Invalid email or password',
    memberInactive: 'Account is inactive. Please contact the gym.',
    accountLocked: 'Account locked. Please try again later.',
    networkError: 'Connection error. Please try again.',
    unknown: 'Something went wrong. Please try again.',
  },
  auth: { logout: 'Logout' },
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add apps/member-app/src/i18n/locales/en.ts
git commit -m "feat(i18n): add landing page and signup flow copy"
```

---

## Task 3: Update signup context with club + gender fields

**Files:**
- Modify: `apps/member-app/app/signup/_layout.tsx`

- [ ] **Step 1: Add clubId, clubName, sex, address, amountHkd to SignupData**

```typescript
import { createContext, useContext, useState } from 'react';
import { Stack } from 'expo-router';
import { colors } from '../../src/theme/colors';

export interface SignupData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  sex: string;
  address: string;
  clubId: number;
  clubName: string;
  planId: number;
  planName: string;
  planPriceHkd: number;
  joiningFee: number;
  adminFee: number;
  facePhotoB64: string;
}

const defaultData: SignupData = {
  firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '',
  sex: '', address: '', clubId: 0, clubName: '',
  planId: 0, planName: '', planPriceHkd: 0, joiningFee: 0, adminFee: 0,
  facePhotoB64: '',
};

interface SignupCtx { data: SignupData; update: (patch: Partial<SignupData>) => void }
const Ctx = createContext<SignupCtx>({ data: defaultData, update: () => {} });
export const useSignup = () => useContext(Ctx);

export default function SignupLayout() {
  const [data, setData] = useState<SignupData>(defaultData);
  const update = (patch: Partial<SignupData>) => setData(d => ({ ...d, ...patch }));

  return (
    <Ctx.Provider value={{ data, update }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </Ctx.Provider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/member-app/app/signup/_layout.tsx
git commit -m "feat(signup): add club, gender, fee fields to signup context"
```

---

## Task 4: Landing page

**Files:**
- Create: `apps/member-app/app/(auth)/landing.tsx`
- Modify: `apps/member-app/app/(auth)/login.tsx` (update "Join GO24" link)

- [ ] **Step 1: Create the landing page**

Build a premium marketing page with:
- Red→dark gradient hero with GO24 logo + tagline
- 4 feature cards (24/7 Access, Face ID, Multi-Location, Premium Equipment) in a 2×2 grid
- Primary CTA "Join GO24" → navigates to `/signup`
- Secondary link "Already a member? Sign In" → navigates back to `/login`
- Follow MASTER.md design system: use `colors`, `type`, `spacing`, `radius`, `shadows` tokens
- Use `LinearGradient` for hero section
- Use `Card` component for feature cards
- Use `Button` component for CTA
- Use `ScreenWrapper` for root

```typescript
// apps/member-app/app/(auth)/landing.tsx
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts, spacing, type as ty, radius, shadows } from '../../src/theme';
import { Button, Card } from '../../src/components';
import { t } from '../../src/i18n';

const FEATURES = [
  { icon: 'time-outline' as const,         title: t.landing.feature1Title, desc: t.landing.feature1Desc, color: colors.blue,   bg: colors.blueBg },
  { icon: 'scan-outline' as const,          title: t.landing.feature2Title, desc: t.landing.feature2Desc, color: colors.teal,   bg: colors.tealBg },
  { icon: 'location-outline' as const,      title: t.landing.feature3Title, desc: t.landing.feature3Desc, color: colors.indigo, bg: colors.indigoBg },
  { icon: 'barbell-outline' as const,       title: t.landing.feature4Title, desc: t.landing.feature4Desc, color: colors.amber,  bg: colors.amberBg },
];

export default function LandingScreen() {
  const router = useRouter();

  return (
    <View style={s.root}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <LinearGradient
          colors={[colors.primary, colors.primaryMid, colors.primaryDark]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <SafeAreaView edges={['top']}>
            <View style={s.heroInner}>
              <View style={s.logoRow}>
                <View style={s.logoBox}>
                  <Ionicons name="fitness" size={28} color="#fff" />
                </View>
                <View>
                  <Text style={s.logoWord}>GO24</Text>
                  <Text style={s.logoSub}>FITNESS</Text>
                </View>
              </View>

              <Text style={s.heroTitle}>{t.landing.hero}</Text>
              <Text style={s.heroSub}>{t.landing.heroSub}</Text>

              <Button
                label={t.landing.joinNow}
                variant="secondary"
                size="lg"
                fullWidth
                icon="arrow-forward"
                iconPosition="right"
                onPress={() => router.push('/signup')}
                style={s.heroCta}
              />
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Features */}
        <View style={s.features}>
          <View style={s.featureGrid}>
            {FEATURES.map(f => (
              <Card key={f.title} style={s.featureCard}>
                <View style={[s.iconBox, { backgroundColor: f.bg }]}>  
                  <Ionicons name={f.icon} size={24} color={f.color} />
                </View>
                <Text style={s.featureTitle}>{f.title}</Text>
                <Text style={s.featureDesc}>{f.desc}</Text>
              </Card>
            ))}
          </View>
        </View>

        {/* Bottom CTA */}
        <View style={s.bottom}>
          <Button
            label={t.landing.joinNow}
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => router.push('/signup')}
          />

          <Pressable
            style={s.signInRow}
            onPress={() => router.replace('/(auth)/login' as any)}
          >
            <Text style={s.signInText}>{t.landing.alreadyMember} </Text>
            <Text style={s.signInLink}>{t.landing.signIn}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  hero: { paddingBottom: radius['2xl'] + spacing.lg },
  heroInner: {
    paddingHorizontal: spacing.xl, paddingTop: spacing['3xl'],
    paddingBottom: spacing.xl,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing['2xl'] },
  logoBox: {
    width: 52, height: 52, borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoWord: { fontSize: 28, fontFamily: fonts.black, color: '#fff', letterSpacing: 4 },
  logoSub:  { fontSize: 9, fontFamily: fonts.bold, color: 'rgba(255,255,255,0.55)', letterSpacing: 4 },

  heroTitle: { ...ty.h1, color: '#fff', marginBottom: spacing.sm },
  heroSub:   { ...ty.body, color: 'rgba(255,255,255,0.7)', marginBottom: spacing['2xl'] },
  heroCta:   { backgroundColor: '#fff', borderColor: '#fff' },

  features: {
    paddingHorizontal: spacing.base, paddingTop: spacing.xl,
    marginTop: -radius['2xl'],
  },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  featureCard: {
    width: '48%', padding: spacing.lg,
  },
  iconBox: {
    width: 48, height: 48, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  featureTitle: { ...ty.h4, color: colors.text, marginBottom: spacing.xs },
  featureDesc:  { ...ty.bodySm, color: colors.textMuted },

  bottom: {
    paddingHorizontal: spacing.xl, paddingTop: spacing['2xl'],
    paddingBottom: spacing['3xl'],
  },
  signInRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingTop: spacing.lg,
  },
  signInText: { ...ty.body, color: colors.textMuted },
  signInLink: { ...ty.bodyBold, color: colors.primary },
});
```

- [ ] **Step 2: Update login.tsx — change "Join GO24" to navigate to `/landing`**

In `apps/member-app/app/(auth)/login.tsx`, find the `joinBtn` Pressable and change:

```typescript
// OLD:
onPress={() => router.push('/signup' as any)}

// NEW:
onPress={() => router.push('/(auth)/landing' as any)}
```

Also update the button text to use i18n:

```typescript
// OLD:
<Text style={s.joinText}>Not a member?</Text>
<Text style={s.joinTextBold}> Join GO24</Text>

// NEW:
<Text style={s.joinText}>{t.login.newToGo24} </Text>
<Text style={s.joinTextBold}>{t.login.joinNow}</Text>
```

- [ ] **Step 3: Commit**

```bash
git add apps/member-app/app/(auth)/landing.tsx apps/member-app/app/(auth)/login.tsx
git commit -m "feat(landing): add premium marketing landing page with feature grid"
```

---

## Task 5: Signup Step 1 — Personal details + club + gender

**Files:**
- Modify: `apps/member-app/app/signup/index.tsx`

- [ ] **Step 1: Rewrite with design system components, add club picker + gender**

Key changes from existing:
- Use `ScreenWrapper`, `ScreenHeader`, `Input`, `Button` components instead of raw styles
- Add gender selection (Male/Female toggle)
- Add club selection (fetch from `GET /public/clubs`, render as selectable list in a modal or inline list)
- Use `type.*` tokens for all text
- Use `spacing.*` for all spacing

```typescript
// apps/member-app/app/signup/index.tsx
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { publicClient } from '../../src/api/public';
import { colors, fonts, spacing, type as ty, radius, shadows } from '../../src/theme';
import { Button, Input, ScreenWrapper, ScreenHeader } from '../../src/components';
import { t } from '../../src/i18n';
import { useSignup } from './_layout';

interface Club { id: number; name: string }

export default function SignupStep1() {
  const router = useRouter();
  const { data, update } = useSignup();

  const [form, setForm] = useState({
    firstName: data.firstName, lastName: data.lastName,
    email: data.email, phone: data.phone, dateOfBirth: data.dateOfBirth,
    sex: data.sex, clubId: data.clubId, clubName: data.clubName,
    address: data.address,
  });
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [showClubPicker, setShowClubPicker] = useState(false);
  const [error, setError] = useState('');

  const loadClubs = useCallback(async () => {
    try {
      const { data: d } = await publicClient.get<Club[]>('/public/clubs');
      setClubs(d);
    } catch {
      setError(t.signup.couldNotLoadClubs);
    } finally { setClubsLoading(false); }
  }, []);

  useEffect(() => { loadClubs(); }, [loadClubs]);

  const patch = (key: string, val: string | number) =>
    setForm(prev => ({ ...prev, [key]: key === 'email' ? (val as string).toLowerCase() : val }));

  const valid =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    form.email.includes('@') &&
    form.phone.trim().length >= 8 &&
    /^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth) &&
    form.clubId > 0;

  const next = () => {
    if (!valid) { setError(t.signup.fillAllFields); return; }
    update(form);
    router.push('/signup/plan');
  };

  return (
    <ScreenWrapper>
      <ScreenHeader showBack title={t.signup.step1Title} subtitle={t.signup.step1Sub}
        rightLabel="1/4" onBack={() => router.back()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.form}>
            <Input label={t.signup.firstName} icon="person-outline"
              value={form.firstName} onChangeText={v => patch('firstName', v)}
              placeholder="John" autoCapitalize="words" />

            <Input label={t.signup.lastName} icon="person-outline"
              value={form.lastName} onChangeText={v => patch('lastName', v)}
              placeholder="Doe" autoCapitalize="words" />

            <Input label={t.signup.email} icon="mail-outline"
              value={form.email} onChangeText={v => patch('email', v)}
              placeholder="john@example.com" keyboardType="email-address"
              autoCapitalize="none" autoComplete="email" />

            <Input label={t.signup.phone} icon="call-outline"
              value={form.phone} onChangeText={v => patch('phone', v)}
              placeholder="+852 9123 4567" keyboardType="phone-pad" />

            <Input label={t.signup.dateOfBirth} icon="calendar-outline"
              value={form.dateOfBirth} onChangeText={v => patch('dateOfBirth', v)}
              placeholder="1990-01-31" hint={t.signup.dobHint} />

            {/* Gender toggle */}
            <View style={s.fieldGap}>
              <Text style={s.label}>{t.signup.gender}</Text>
              <View style={s.genderRow}>
                {(['Male', 'Female'] as const).map(g => (
                  <Pressable key={g}
                    style={[s.genderBtn, form.sex === g && s.genderBtnActive]}
                    onPress={() => patch('sex', g)}>
                    <Ionicons name={g === 'Male' ? 'male' : 'female'} size={16}
                      color={form.sex === g ? '#fff' : colors.textMuted} />
                    <Text style={[s.genderTxt, form.sex === g && s.genderTxtActive]}>
                      {g === 'Male' ? t.signup.genderMale : t.signup.genderFemale}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Club selector */}
            <View style={s.fieldGap}>
              <Text style={s.label}>{t.signup.homeClub}</Text>
              {clubsLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.sm }} />
              ) : (
                <Pressable style={s.clubPicker} onPress={() => setShowClubPicker(true)}>
                  <Ionicons name="location-outline" size={18} color={colors.textMuted} />
                  <Text style={[s.clubPickerTxt, !form.clubName && { color: colors.textMuted }]}>
                    {form.clubName || t.signup.selectClub}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                </Pressable>
              )}
            </View>
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <Button label={t.signup.nextPlan} variant="primary" size="lg" fullWidth
            disabled={!valid} onPress={next} icon="arrow-forward" iconPosition="right" />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Club picker modal */}
      <Modal visible={showClubPicker} animationType="slide" transparent>
        <View style={s.modalScrim}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{t.signup.homeClub}</Text>
            <ScrollView style={s.modalList}>
              {clubs.map(c => (
                <Pressable key={c.id}
                  style={[s.clubRow, form.clubId === c.id && s.clubRowActive]}
                  onPress={() => { patch('clubId', c.id); setForm(prev => ({ ...prev, clubName: c.name })); setShowClubPicker(false); }}>
                  <Ionicons name="location" size={18}
                    color={form.clubId === c.id ? colors.primary : colors.textMuted} />
                  <Text style={[s.clubName, form.clubId === c.id && { color: colors.primary, fontFamily: fonts.bold }]}>
                    {c.name}
                  </Text>
                  {form.clubId === c.id && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                </Pressable>
              ))}
            </ScrollView>
            <Button label="Done" variant="ghost" size="md" onPress={() => setShowClubPicker(false)} />
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const s = StyleSheet.create({
  scroll: { padding: spacing.xl, paddingBottom: spacing['3xl'] },
  form:   { gap: spacing.base, marginBottom: spacing.xl },

  fieldGap: { gap: spacing.xs },
  label: { ...ty.labelSm, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  genderRow:    { flexDirection: 'row', gap: spacing.sm },
  genderBtn:    {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  genderBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  genderTxt:       { ...ty.body, color: colors.textMuted },
  genderTxtActive: { color: '#fff', fontFamily: fonts.bold },

  clubPicker: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    paddingHorizontal: spacing.md, height: 50,
  },
  clubPickerTxt: { flex: 1, ...ty.body, color: colors.text },

  error: { ...ty.bodySm, color: colors.error, marginBottom: spacing.md },

  modalScrim:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:  {
    backgroundColor: colors.card, borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing['2xl'],
    maxHeight: '70%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  modalTitle:  { ...ty.h3, color: colors.text, marginBottom: spacing.lg },
  modalList:   { marginBottom: spacing.lg },
  clubRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  clubRowActive: { backgroundColor: colors.primaryBg, marginHorizontal: -spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  clubName:    { flex: 1, ...ty.body, color: colors.text },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/member-app/app/signup/index.tsx
git commit -m "feat(signup): step 1 with club picker, gender toggle, design system components"
```

---

## Task 6: Signup Step 2 — Plan selection with fee breakdown

**Files:**
- Modify: `apps/member-app/app/signup/plan.tsx`

- [ ] **Step 1: Update to show fee breakdown and use design system**

Key changes:
- Show `membershipFee`, `joiningFee`, `adminFee` per plan
- Use `ScreenWrapper`, `ScreenHeader`, `Card`, `Button` components
- Update plan interface to match new backend response

```typescript
// apps/member-app/app/signup/plan.tsx
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { publicClient } from '../../src/api/public';
import { colors, fonts, spacing, type as ty, radius, shadows } from '../../src/theme';
import { Button, Card, ScreenWrapper, ScreenHeader } from '../../src/components';
import { t } from '../../src/i18n';
import { useSignup } from './_layout';

interface Plan {
  id: number; name: string;
  membershipFee: number; joiningFee: number; adminFee: number;
  description: string | null;
}

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
      setError(t.signup.couldNotLoadPlans);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedPlan = plans.find(p => p.id === selected);

  const next = () => {
    if (!selectedPlan) return;
    update({
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      planPriceHkd: selectedPlan.membershipFee,
      joiningFee: selectedPlan.joiningFee,
      adminFee: selectedPlan.adminFee,
    });
    router.push('/signup/selfie');
  };

  return (
    <ScreenWrapper>
      <ScreenHeader showBack title={t.signup.step2Title} subtitle={t.signup.step2Sub}
        rightLabel="2/4" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={s.scroll}>
        {loading ? (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: spacing['3xl'] }} />
        ) : error ? (
          <View style={s.errorBox}>
            <Text style={s.error}>{error}</Text>
            <Button label={t.signup.tryAgain} variant="secondary" size="sm" onPress={load} />
          </View>
        ) : (
          <View style={s.plans}>
            {plans.map(p => (
              <Pressable key={p.id} onPress={() => setSelected(p.id)}>
                <Card style={[s.card, selected === p.id && s.cardSelected]}>
                  <View style={s.cardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.planName}>{p.name}</Text>
                      {p.description ? <Text style={s.planDesc}>{p.description}</Text> : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.price}>HK${p.membershipFee}</Text>
                      <Text style={s.perMonth}>{t.signup.perMonth}</Text>
                    </View>
                  </View>

                  {/* Fee breakdown */}
                  {(p.joiningFee > 0 || p.adminFee > 0) && (
                    <View style={s.fees}>
                      {p.joiningFee > 0 && (
                        <View style={s.feeRow}>
                          <Text style={s.feeLabel}>{t.signup.joiningFee}</Text>
                          <Text style={s.feeVal}>HK${p.joiningFee}</Text>
                        </View>
                      )}
                      {p.adminFee > 0 && (
                        <View style={s.feeRow}>
                          <Text style={s.feeLabel}>{t.signup.adminFee}</Text>
                          <Text style={s.feeVal}>HK${p.adminFee}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {selected === p.id && (
                    <View style={s.checkIcon}>
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    </View>
                  )}
                </Card>
              </Pressable>
            ))}
          </View>
        )}

        <Button label={t.signup.nextSelfie} variant="primary" size="lg" fullWidth
          disabled={!selected} onPress={next} icon="arrow-forward" iconPosition="right" />
      </ScrollView>
    </ScreenWrapper>
  );
}

const s = StyleSheet.create({
  scroll:   { padding: spacing.xl, paddingBottom: spacing['3xl'] },
  plans:    { gap: spacing.md, marginBottom: spacing.xl },
  card:     { borderWidth: 1.5, borderColor: colors.border },
  cardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryBg + '30' },
  cardRow:  { flexDirection: 'row', alignItems: 'flex-start' },
  planName: { ...ty.h4, color: colors.text },
  planDesc: { ...ty.bodySm, color: colors.textMuted, marginTop: spacing.xs },
  price:    { fontSize: 22, fontFamily: fonts.black, color: colors.primary },
  perMonth: { ...ty.caption, color: colors.textMuted },
  fees:     { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: spacing.xs },
  feeRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  feeLabel: { ...ty.bodySm, color: colors.textMuted },
  feeVal:   { ...ty.bodySm, color: colors.textSecond, fontFamily: fonts.semibold },
  checkIcon:{ position: 'absolute', top: spacing.md, right: spacing.md },
  errorBox: { alignItems: 'center', gap: spacing.md, marginVertical: spacing['2xl'] },
  error:    { ...ty.body, color: colors.error },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/member-app/app/signup/plan.tsx
git commit -m "feat(signup): step 2 plan selection with fee breakdown and design system"
```

---

## Task 7: Signup Step 3 — Selfie (migrate to design system)

**Files:**
- Modify: `apps/member-app/app/signup/selfie.tsx`

- [ ] **Step 1: Migrate to use ScreenWrapper, ScreenHeader, Button, and i18n**

The existing selfie.tsx is functionally complete. Migrate it to use design system components:
- Replace SafeAreaView with `ScreenWrapper`
- Replace manual topRow with `ScreenHeader`
- Replace Pressable buttons with `Button` component
- Use i18n strings
- Keep the ImagePicker logic exactly as-is (it works)

```typescript
// apps/member-app/app/signup/selfie.tsx
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts, spacing, type as ty, radius } from '../../src/theme';
import { Button, Card, ScreenWrapper, ScreenHeader } from '../../src/components';
import { t } from '../../src/i18n';
import { useSignup } from './_layout';

export default function SignupStep3() {
  const router = useRouter();
  const { data, update } = useSignup();
  const [photo, setPhoto] = useState<string>(data.facePhotoB64);
  const [error, setError] = useState('');

  const takePhoto = async () => {
    setError('');
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { setError(t.signup.cameraPermRequired); return; }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
      base64: true, cameraType: ImagePicker.CameraType.front,
    });
    if (!result.canceled && result.assets[0]?.base64) setPhoto(result.assets[0].base64);
  };

  const pickFromLibrary = async () => {
    setError('');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) setPhoto(result.assets[0].base64);
  };

  const next = () => {
    if (!photo) { setError(t.signup.takeSelfieFirst); return; }
    update({ facePhotoB64: photo });
    router.push('/signup/payment');
  };

  return (
    <ScreenWrapper>
      <ScreenHeader showBack title={t.signup.step3Title} subtitle={t.signup.step3Sub}
        rightLabel="3/4" onBack={() => router.back()} />

      <View style={s.content}>
        <Pressable style={s.photoCircle} onPress={takePhoto}>
          {photo ? (
            <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={s.photo} />
          ) : (
            <View style={s.photoEmpty}>
              <Ionicons name="camera-outline" size={48} color={colors.textMuted} />
              <Text style={s.photoHint}>{t.signup.tapToTakeSelfie}</Text>
            </View>
          )}
        </Pressable>

        <View style={s.actions}>
          <Pressable style={s.actionBtn} onPress={takePhoto}>
            <Ionicons name="camera-outline" size={18} color={colors.primary} />
            <Text style={s.actionTxt}>{t.signup.camera}</Text>
          </Pressable>
          <Pressable style={s.actionBtn} onPress={pickFromLibrary}>
            <Ionicons name="image-outline" size={18} color={colors.primary} />
            <Text style={s.actionTxt}>{t.signup.gallery}</Text>
          </Pressable>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <Card style={s.tips}>
          <Text style={s.tipsTitle}>{t.signup.tipsTitle}</Text>
          {[t.signup.cameraTip1, t.signup.cameraTip2, t.signup.cameraTip3].map(tip => (
            <View key={tip} style={s.tipRow}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={s.tipTxt}>{tip}</Text>
            </View>
          ))}
        </Card>

        <Button label={t.signup.nextPayment} variant="primary" size="lg" fullWidth
          disabled={!photo} onPress={next} icon="arrow-forward" iconPosition="right" />
      </View>
    </ScreenWrapper>
  );
}

const s = StyleSheet.create({
  content:     { flex: 1, padding: spacing.xl },
  photoCircle: { width: 180, height: 180, borderRadius: 90, alignSelf: 'center', overflow: 'hidden', marginBottom: spacing.lg },
  photo:       { width: '100%', height: '100%' },
  photoEmpty:  {
    flex: 1, backgroundColor: colors.card,
    borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 90,
    alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  photoHint:   { ...ty.caption, color: colors.textMuted },
  actions:     { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.base },
  actionBtn:   {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.primaryBg, borderRadius: radius.md, paddingVertical: spacing.md,
  },
  actionTxt:   { ...ty.body, color: colors.primary, fontFamily: fonts.semibold },
  error:       { ...ty.bodySm, color: colors.error, textAlign: 'center', marginBottom: spacing.md },
  tips:        { gap: spacing.sm, marginBottom: spacing.xl },
  tipsTitle:   { ...ty.label, color: colors.text, marginBottom: spacing.xs },
  tipRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tipTxt:      { ...ty.bodySm, color: colors.textMuted },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/member-app/app/signup/selfie.tsx
git commit -m "style(signup): migrate selfie step to design system components"
```

---

## Task 8: Signup Step 4 — Payment (fix Platform import + design system)

**Files:**
- Modify: `apps/member-app/app/signup/payment.tsx`

- [ ] **Step 1: Fix Platform import and migrate to design system**

The existing payment.tsx has a bug: `import { ..., Platform } from 'react';` — Platform should be imported from `react-native`. Also update to pass `amountHkd` in the complete call and use design system.

```typescript
// apps/member-app/app/signup/payment.tsx
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { publicClient } from '../../src/api/public';
import { tokenStorage } from '../../src/auth/storage';
import { colors, fonts, spacing, type as ty, radius, shadows } from '../../src/theme';
import { Button, Card, ScreenWrapper, ScreenHeader } from '../../src/components';
import { t } from '../../src/i18n';
import { useSignup } from './_layout';

export default function SignupStep4() {
  const router  = useRouter();
  const { data } = useSignup();
  const [session, setSession]   = useState<{ sessionId: string; sessionData: string; clientKey: string; environment: string } | null>(null);
  const [AdyenCheckout, setAdyenCheckout] = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [paying, setPaying]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (Platform.OS !== 'web') {
      import('@adyen/react-native').then(m => setAdyenCheckout(() => m.AdyenCheckout)).catch(() => {});
    }
  }, []);

  const totalAmount = data.planPriceHkd + (data.joiningFee ?? 0) + (data.adminFee ?? 0);

  const loadSession = useCallback(async () => {
    try {
      const { data: s } = await publicClient.post('/public/signup/session', {
        planId:       data.planId,
        amountHkd:    totalAmount,
        shopperEmail: data.email,
      });
      setSession(s);
    } catch {
      setError(t.signup.paymentInitError);
    } finally { setLoading(false); }
  }, [data.planId, totalAmount, data.email]);

  useEffect(() => { loadSession(); }, [loadSession]);

  const completeSignup = async (pspReference: string) => {
    setPaying(true);
    try {
      const { data: result } = await publicClient.post('/public/signup/complete', {
        firstName:         data.firstName,
        lastName:          data.lastName,
        email:             data.email,
        phone:             data.phone,
        dateOfBirth:       data.dateOfBirth,
        sex:               data.sex,
        address:           '',
        clubId:            data.clubId,
        planId:            data.planId,
        amountHkd:         totalAmount,
        facePhotoB64:      data.facePhotoB64,
        adyenPspReference: pspReference,
      });
      await tokenStorage.setTokens(result.accessToken, result.refreshToken);
      router.replace('/signup/success' as any);
    } catch {
      Alert.alert(t.signup.setupErrorTitle, t.signup.setupErrorMsg);
    } finally { setPaying(false); }
  };

  if (loading) return (
    <ScreenWrapper>
      <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
    </ScreenWrapper>
  );

  if (Platform.OS === 'web') return (
    <ScreenWrapper>
      <ScreenHeader showBack title={t.signup.step4Title} rightLabel="4/4" onBack={() => router.back()} />
      <View style={s.webNotice}>
        <Ionicons name="phone-portrait-outline" size={48} color={colors.primary} />
        <Text style={s.webTitle}>{t.signup.completeOnMobile}</Text>
        <Text style={s.webSub}>{t.signup.completeOnMobileSub}</Text>
      </View>
    </ScreenWrapper>
  );

  return (
    <ScreenWrapper>
      <ScreenHeader showBack title={t.signup.step4Title} rightLabel="4/4" onBack={() => router.back()} />

      <View style={s.content}>
        <Card style={s.summary}>
          <Text style={s.summaryPlan}>{data.planName}</Text>
          <Text style={s.summaryPrice}>HK${totalAmount}</Text>
          <Text style={s.summaryNote}>{t.signup.firstMonth}</Text>
          {(data.joiningFee > 0 || data.adminFee > 0) && (
            <View style={s.summaryBreakdown}>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Membership</Text>
                <Text style={s.summaryVal}>HK${data.planPriceHkd}</Text>
              </View>
              {data.joiningFee > 0 && (
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>{t.signup.joiningFee}</Text>
                  <Text style={s.summaryVal}>HK${data.joiningFee}</Text>
                </View>
              )}
              {data.adminFee > 0 && (
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>{t.signup.adminFee}</Text>
                  <Text style={s.summaryVal}>HK${data.adminFee}</Text>
                </View>
              )}
            </View>
          )}
        </Card>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {session && AdyenCheckout && (
          <AdyenCheckout
            session={session}
            onComplete={(result: any) => {
              if (result.resultCode === 'Authorised' || result.resultCode === 'Pending') {
                completeSignup(result.sessionResult ?? session.sessionId);
              } else {
                setError(`${t.signup.paymentDeclined} (${result.resultCode})`);
              }
            }}
            onError={(e: any) => setError(e?.message ?? t.signup.paymentFailed)}
          />
        )}

        {paying && (
          <View style={s.payingOverlay}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={s.payingText}>{t.signup.settingUpAccount}</Text>
          </View>
        )}
      </View>
    </ScreenWrapper>
  );
}

const s = StyleSheet.create({
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, padding: spacing.xl },

  summary:          { gap: spacing.xs, marginBottom: spacing.xl },
  summaryPlan:      { ...ty.bodySm, color: colors.textMuted },
  summaryPrice:     { fontSize: 28, fontFamily: fonts.black, color: colors.primary },
  summaryNote:      { ...ty.caption, color: colors.textMuted },
  summaryBreakdown: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: spacing.xs },
  summaryRow:       { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel:     { ...ty.bodySm, color: colors.textMuted },
  summaryVal:       { ...ty.bodySm, color: colors.textSecond, fontFamily: fonts.semibold },

  error:   { ...ty.body, color: colors.error, marginBottom: spacing.base },

  payingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center', gap: spacing.md,
  },
  payingText: { ...ty.bodyBold, color: colors.text },

  webNotice: { alignItems: 'center', gap: spacing.base, paddingTop: spacing['5xl'] },
  webTitle:  { ...ty.h3, color: colors.text },
  webSub:    { ...ty.body, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/member-app/app/signup/payment.tsx
git commit -m "fix(signup): fix Platform import, add fee breakdown, migrate to design system"
```

---

## Task 9: Success screen

**Files:**
- Create: `apps/member-app/app/signup/success.tsx`

- [ ] **Step 1: Create the success screen**

```typescript
// apps/member-app/app/signup/success.tsx
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts, spacing, type as ty, radius } from '../../src/theme';
import { Button, ScreenWrapper } from '../../src/components';
import { t } from '../../src/i18n';

export default function SignupSuccess() {
  const router = useRouter();

  return (
    <ScreenWrapper>
      <View style={s.content}>
        <View style={s.iconCircle}>
          <Ionicons name="checkmark-circle" size={72} color={colors.success} />
        </View>

        <Text style={s.title}>{t.signup.successTitle}</Text>
        <Text style={s.sub}>{t.signup.successSub}</Text>

        <View style={s.faceCard}>
          <Ionicons name="scan-outline" size={24} color={colors.teal} />
          <Text style={s.faceText}>{t.signup.faceIdPending}</Text>
        </View>

        <Button
          label={t.signup.goToHome}
          variant="primary"
          size="lg"
          fullWidth
          icon="arrow-forward"
          iconPosition="right"
          onPress={() => router.replace('/(tabs)' as any)}
        />
      </View>
    </ScreenWrapper>
  );
}

const s = StyleSheet.create({
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: spacing.xl,
  },
  iconCircle: { marginBottom: spacing.xl },
  title:   { ...ty.h1, color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  sub:     { ...ty.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing['2xl'] },
  faceCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.tealBg, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing['2xl'],
    alignSelf: 'stretch',
  },
  faceText: { ...ty.bodySm, color: colors.teal, flex: 1 },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/member-app/app/signup/success.tsx
git commit -m "feat(signup): add success screen with face ID status"
```

---

## Task 10: Integration test — manual walkthrough

- [ ] **Step 1: Start the backend**

```bash
cd backend/nest-api && pnpm run start:dev
```

Verify the new endpoints respond:
- `GET http://localhost:3000/v1/public/clubs` → returns club list
- `GET http://localhost:3000/v1/public/plans` → returns plans with fee breakdown

- [ ] **Step 2: Start the mobile app**

```bash
cd apps/member-app && npx expo start --web --port 8085
```

- [ ] **Step 3: Walk through the flow**

1. Login screen → tap "New to GO24? Join Now" → lands on landing page
2. Landing page → "Join GO24" → enters signup step 1
3. Step 1 → fill name, email, phone, DOB, gender, select club → "Next: Choose Plan"
4. Step 2 → select a plan → see fee breakdown → "Next: Take Selfie"
5. Step 3 → take/select photo → "Next: Payment"
6. Step 4 → see payment summary with fee breakdown → (Adyen only works on native)
7. On native: Adyen payment → success screen → "Start Training" → home

- [ ] **Step 4: Verify PGM integration in logs**

After a successful signup on native, check backend logs for:
```
PGM member created: <memberId>
PGM contract created: <contractId>
PGM payment settled for contract <contractId>
```

- [ ] **Step 5: Commit any fixes from testing**

```bash
git add -A
git commit -m "fix(signup): integration test fixes"
```

---

## Dependencies / Order

```
Task 1 (backend) ─── can run independently
Task 2 (i18n)    ─── can run independently
Task 3 (context) ─── can run independently
Task 4 (landing) ─── depends on Task 2 (i18n strings)
Task 5 (step 1)  ─── depends on Tasks 1, 2, 3
Task 6 (step 2)  ─── depends on Tasks 1, 2, 3
Task 7 (step 3)  ─── depends on Tasks 2, 3
Task 8 (step 4)  ─── depends on Tasks 1, 2, 3
Task 9 (success) ─── depends on Task 2
Task 10 (test)   ─── depends on all above
```

Parallelizable: Tasks 1, 2, 3 can all run concurrently. Tasks 4-9 can mostly run concurrently after 1-3 complete.
