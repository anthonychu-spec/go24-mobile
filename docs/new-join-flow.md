# GO24 New Member Join Flow

> Complete documentation of the signup journey — from marketing landing to active membership.

**Last updated:** 2026-05-15

---

## Table of Contents

1. [Flow Overview](#flow-overview)
2. [Architecture](#architecture)
3. [Frontend Screens (Native App)](#frontend-screens-native-app)
4. [Backend API Endpoints](#backend-api-endpoints)
5. [PGM Integration](#pgm-integration)
6. [Adyen Payment](#adyen-payment)
7. [Face ID / Suprema](#face-id--suprema)
8. [Data Model](#data-model)
9. [Web Landing Page](#web-landing-page)
10. [Known Issues & TODOs](#known-issues--todos)

---

## Flow Overview

```
Login Screen
  └─ "Not a member? Join GO24"
       └─ Landing Page (marketing)
            └─ "Join GO24" CTA
                 └─ Step 1: Personal Details (name, email, phone, DOB, gender, club)
                      └─ Step 2: Select Plan (per-club, online-only plans)
                           └─ Step 3: Start Date (next 7 days picker)
                                └─ Step 4: Face Photo (selfie for Suprema BioStation)
                                     └─ Step 5: Payment (pro-rata + fees + T&C + Adyen)
                                          └─ Success (auto-login, JWT issued)
```

**Entry points:**
- Login screen → "Not a member? Join GO24" link
- Direct URL: `/(auth)/landing`
- Web: `go24fitness.com` HTML landing page (standalone)

---

## Architecture

### Tech Stack
- **Frontend:** React Native / Expo SDK 54, expo-router (file-based routing)
- **Backend:** NestJS, TypeORM, PostgreSQL
- **PGM:** Perfect Gym Manager API (v2.1 Members, v2.2 Contracts/Transactions)
- **Payment:** Adyen (native: `@adyen/react-native`, web: TBD)
- **Face ID:** Suprema BioStation 3 via REST API
- **Auth:** JWT (access 15m + refresh 30d rotation)

### File Map

```
apps/member-app/
  app/
    (auth)/
      landing.tsx              ← Marketing landing page
    signup/
      _layout.tsx              ← SignupData context provider
      index.tsx                ← Step 1: Personal Details
      plan.tsx                 ← Step 2: Choose Plan
      startdate.tsx            ← Step 3: Start Date
      selfie.tsx               ← Step 4: Face Photo
      payment.tsx              ← Step 5: Payment
      success.tsx              ← Success screen
  src/
    api/public.ts              ← Axios client (no JWT)
    i18n/locales/en.ts         ← All signup i18n strings

backend/nest-api/src/
  signup/
    signup.module.ts
    signup.service.ts          ← Core orchestration
    signup.controller.ts       ← Public + protected routes
    dto/signup.dto.ts          ← SignupSessionDto, SignupCompleteDto
    entities/
      face-enrollment.entity.ts
  payments/
    adyen.client.ts            ← createSession(), charge()
  auth/
    auth.service.ts            ← createUser(), issueTokensForNewUser()

apps/web-landing/
  index.html                   ← Standalone HTML for go24fitness.com
```

---

## Frontend Screens (Native App)

### Landing Page — `app/(auth)/landing.tsx`

| Property | Value |
|----------|-------|
| Route | `/(auth)/landing` |
| Auth required | No |
| Navigation from | Login screen ("Not a member? Join GO24") |
| Navigation to | `/signup` (Step 1) or `/(auth)/login` |

**Layout:**
- Red gradient hero with GO24 logo + "Your Fitness Journey Starts Here"
- 4-card feature grid: 24/7 Access, Face ID Entry, Multi-Location, Premium Equipment
- Bottom CTA: "Join GO24" button
- "Already a member? Sign In" link

**Components used:** `Button`, `Card`, `ScreenWrapper` (design system)

---

### Step 1: Personal Details — `app/signup/index.tsx`

| Property | Value |
|----------|-------|
| Route | `/signup` (index) |
| Header | "Personal Details" — Step 1/5 |
| Navigation to | `/signup/plan` |

**Fields collected:**
| Field | Type | Validation |
|-------|------|------------|
| First Name | text | required |
| Last Name | text | required |
| Email | email | must contain `@` |
| Phone | tel | >= 8 characters |
| Date of Birth | text | YYYY-MM-DD format |
| Gender | toggle | Male / Female |
| Home Club | modal picker | fetched from `/public/clubs` |
| Address | text | optional |

**API calls:**
- `GET /public/clubs` → populates club picker modal

**Context update:** saves all fields to `SignupData`

---

### Step 2: Choose Plan — `app/signup/plan.tsx`

| Property | Value |
|----------|-------|
| Route | `/signup/plan` |
| Header | "Choose Your Plan" — Step 2/5 |
| Navigation to | `/signup/startdate` |

**Behavior:**
- Fetches plans: `GET /public/plans?clubId={clubId}`
- Shows plan cards with: name, HK$ price/month, joining fee, admin fee
- Selected plan highlighted with primary border

**Context update:** `planId`, `planName`, `planPriceHkd`, `joiningFee`, `adminFee`

---

### Step 3: Start Date — `app/signup/startdate.tsx`

| Property | Value |
|----------|-------|
| Route | `/signup/startdate` |
| Header | "Start Date" — Step 3/5 |
| Navigation to | `/signup/selfie` |

**Behavior:**
- Shows next 7 days as selectable tiles
- Default: today
- Summary box shows selected date formatted

**Context update:** `startDate` (ISO string, e.g. `"2026-05-15"`)

---

### Step 4: Face Photo — `app/signup/selfie.tsx`

| Property | Value |
|----------|-------|
| Route | `/signup/selfie` |
| Header | "Face ID Setup" — Step 4/5 |
| Navigation to | `/signup/payment` |

**Behavior:**
- Uses `expo-image-picker` (front camera, 1:1 aspect, quality 0.7)
- Also supports gallery picker
- Shows tips: face camera directly, good lighting, no glasses, plain background

**Context update:** `facePhotoB64` (base64 encoded JPEG)

---

### Step 5: Payment — `app/signup/payment.tsx`

| Property | Value |
|----------|-------|
| Route | `/signup/payment` |
| Header | "Payment" — Step 5/5 |
| Navigation to | `/signup/success` |

**Fee Breakdown:**

```
Pro-rata first month:    HK$ (membershipFee / daysInMonth) * remainingDays
Access code fee:         HK$ adminFee
Joining fee:             HK$ joiningFee
────────────────────────────────────────
Total due today:         HK$ sum of above

From month 2:            HK$ membershipFee/month
```

- **Day pass** (planPriceHkd <= 300): no pro-rata, flat fee
- **Pro-rata**: `Math.round((membershipFee / daysInMonth) * remainingDays)` where remainingDays = daysInMonth - dayOfMonth + 1 (inclusive)

**T&C Checkbox:** required before proceeding. Links to `https://go24fitness.com/terms`

**Adyen Integration (native):**
1. Creates session: `POST /public/signup/session` → `{ sessionId, sessionData, clientKey, environment }`
2. Renders `AdyenCheckout` component (`@adyen/react-native`)
3. On `Authorised` / `Pending` → calls `POST /public/signup/complete`

**Web fallback:** Shows "Complete payment on mobile app" message (Adyen web Drop-In not yet implemented)

**After payment success:**
1. Backend creates PGM member + contract + payment
2. Backend issues JWT (access + refresh tokens)
3. App stores tokens via `tokenStorage`
4. Navigates to success screen

---

### Success — `app/signup/success.tsx`

| Property | Value |
|----------|-------|
| Route | `/signup/success` |
| Navigation to | `/(tabs)` (main app) |

**Shows:**
- Green checkmark animation
- "Welcome to GO24!" title
- "Your membership is active" subtitle
- Face ID pending notice card (teal)
- "Start Training" button → replaces stack with main app

---

## Backend API Endpoints

### Public Routes (no JWT)

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/public/clubs` | `getClubs()` | List PGM clubs (filtered) |
| GET | `/public/plans?clubId=X` | `getPlans(clubId?)` | Per-club online plans |
| POST | `/public/signup/session` | `createSignupSession()` | Create Adyen payment session |
| POST | `/public/signup/complete` | `completeSignup()` | Full signup orchestration |
| POST | `/webhooks/suprema/enroll` | `handleSupremaWebhook()` | Suprema callback |

### Protected Routes (JWT required)

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| POST | `/me/face/retry` | `retryFaceEnrollment()` | Re-submit face photo |
| GET | `/me/face/status` | `getEnrollmentStatus()` | Check enrollment status |

---

### `GET /public/clubs`

Returns PGM clubs, filtered:
- Excludes clubs with `_` in name (test clubs)

Response:
```json
[
  { "id": 16, "name": "GO24 Fitness - Mong Kok" },
  { "id": 36, "name": "ONYX Fitness - Central" },
  { "id": 39, "name": "ONYX Fitness - Admiralty" }
]
```

---

### `GET /public/plans?clubId=X`

Filters:
1. `isDeleted eq false AND isActive eq true` from PGM OData
2. Name contains `"Online"` (PGM naming convention)
3. Excludes plans with `renewal` or `upgrade` in name
4. If `clubId` provided: matches brand (GO24 or ONYX based on club name)
5. Day Pass club-specific logic:
   - Club 39 (Admiralty) → ONYX Admiralty day pass
   - Club 36 (Central) → ONYX Central day pass
   - Other ONYX clubs → generic ONYX day pass
   - GO24 clubs → GO24 day pass

Response:
```json
[
  {
    "id": 123,
    "name": "GO24 Monthly Online",
    "membershipFee": 678,
    "joiningFee": 200,
    "adminFee": 100,
    "description": null
  }
]
```

---

### `POST /public/signup/session`

Request body (`SignupSessionDto`):
```json
{
  "planId": 123,
  "amountHkd": 978,
  "shopperEmail": "user@example.com"
}
```

Response:
```json
{
  "sessionId": "CS...",
  "sessionData": "...",
  "clientKey": "live_...",
  "environment": "live"
}
```

---

### `POST /public/signup/complete`

Request body (`SignupCompleteDto`):
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "91234567",
  "dateOfBirth": "1990-01-15",
  "sex": "Male",
  "address": "123 Nathan Road",
  "clubId": 16,
  "planId": 123,
  "startDate": "2026-05-15",
  "amountHkd": 978,
  "facePhotoB64": "/9j/4AAQ...",
  "adyenPspReference": "CS..."
}
```

**Backend orchestration (7 steps):**

```
1. POST ../v2.1/Members/AddGuestMember     → pgmMemberId
2. POST /Contracts/AddContract              → contractId
3. POST /Transactions/AddContractPayment    → payment recorded
4. auth.createUser(pgmMemberId, email, phone)
5. submitFaceToSuprema (async, non-blocking)
6. sendDirectPush("Welcome to GO24!")
7. auth.issueTokensForNewUser()             → { accessToken, refreshToken }
```

Response:
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "a1b2c3...",
  "user": {
    "id": "uuid",
    "pgmId": 12345,
    "role": "member",
    "email": "john@example.com"
  }
}
```

---

## PGM Integration

### Endpoints Used

| # | Endpoint | PGM Version | Purpose |
|---|----------|-------------|---------|
| 1 | `POST /Api/v2.1/Members/AddGuestMember` | v2.1 | Create member |
| 2 | `POST /Api/v2.2/Contracts/AddContract` | v2.2 | Create contract |
| 3 | `POST /Api/v2.2/Transactions/AddContractPayment` | v2.2 | Record payment |
| 4 | `GET /odata/PaymentPlans` | OData | List plans |
| 5 | `GET /odata/Clubs` | OData | List clubs |

### AddGuestMember Payload
```json
{
  "homeClubId": 16,
  "personalData": {
    "firstName": "John",
    "lastName": "Doe",
    "sex": "Male",
    "phoneNumber": "91234567",
    "email": "john@example.com",
    "dateOfBirth": "1990-01-15"
  },
  "addressData": {
    "street": "123 Nathan Road"
  }
}
```

### AddContract Payload
```json
{
  "memberId": 12345,
  "paymentPlanId": 123,
  "startDate": "2026-05-15",
  "signUpDate": "2026-05-15"
}
```

### AddContractPayment Payload
```json
{
  "vatRateId": 3,
  "clubId": 16,
  "paymentType": "Online",
  "memberId": 12345,
  "contractId": 67890,
  "amountGross": 978,
  "description": "go24fitness-hk-Membership Fee, e-provider='Adyen'",
  "systemType": "Membership",
  "transactionDate": "2026-05-15T00:00:00"
}
```

### PGM Credentials (Staging)
```
Base URL: https://go24hk.perfectgym.com/Api
X-Client-Id: <redacted>
X-Client-Secret: <redacted>
```

---

## Adyen Payment

### Native (implemented)
- Library: `@adyen/react-native`
- Session-based flow (no server-side `/payments` call needed)
- Component: `AdyenCheckout` renders drop-in UI
- Handles: cards, Apple Pay, Google Pay (depending on Adyen config)

### Web (NOT YET IMPLEMENTED)
- Needs: `@adyen/adyen-web` (Drop-In component)
- Plan: `payment.native.tsx` + `payment.web.tsx` platform split
- Current: shows "Complete payment on mobile app" message on web

### Flow
```
App                         Backend                      Adyen
 |                            |                            |
 |-- POST /signup/session --->|                            |
 |                            |-- Create session --------->|
 |                            |<-- sessionId + data -------|
 |<-- session config ---------|                            |
 |                            |                            |
 |-- Render AdyenCheckout --->|                            |
 |        (user pays)         |                            |
 |                            |                            |
 |-- POST /signup/complete -->|                            |
 |                            |-- AddGuestMember (PGM) --->|
 |                            |-- AddContract (PGM) ------>|
 |                            |-- AddPayment (PGM) ------->|
 |                            |-- Issue JWT --------------->|
 |<-- tokens + user ----------|                            |
```

---

## Face ID / Suprema

### Flow
```
Signup Payment Success
  └─ Backend: submitFaceToSuprema() (async, non-blocking)
       └─ POST {SUPREMA_API_URL}/api/members/{pgmId}/faces
            Body: { photoBase64, webhookUrl, userId }
            Header: X-API-Key
       └─ Upsert FaceEnrollment record (status: 'pending')

Suprema processes... (async)
  └─ POST /webhooks/suprema/enroll (callback)
       └─ Update FaceEnrollment → 'enrolled' or 'failed'
       └─ Send push notification to user
```

### FaceEnrollment Entity
```typescript
{
  id: UUID,
  userId: string,        // FK to User
  pgmMemberId: number,
  photoB64: text | null, // cleared after processing
  status: 'pending' | 'enrolled' | 'failed',
  supremaResponse: jsonb | null,
  createdAt: timestamp,
  updatedAt: timestamp,
}
```

### Retry
- User can retry via `POST /me/face/retry` with new `facePhotoB64`
- App checks status via `GET /me/face/status`

---

## Data Model

### SignupData Context (Frontend)

```typescript
interface SignupData {
  // Step 1: Personal Details
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;       // "YYYY-MM-DD"
  sex: string;               // "Male" | "Female"
  address: string;
  clubId: number;
  clubName: string;

  // Step 2: Plan
  planId: number;
  planName: string;
  planPriceHkd: number;      // monthly fee
  joiningFee: number;
  adminFee: number;

  // Step 3: Start Date
  startDate: string;         // ISO "YYYY-MM-DD"

  // Step 4: Face
  facePhotoB64: string;      // base64 JPEG
}
```

### SignupCompleteDto (Backend)

```typescript
class SignupCompleteDto {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  sex: string;
  address: string;
  clubId: number;
  planId: number;
  startDate: string;
  amountHkd: number;         // total charged today
  facePhotoB64: string;
  adyenPspReference: string; // Adyen session/PSP reference
}
```

---

## Web Landing Page

**File:** `apps/web-landing/index.html`

Standalone HTML page for `go24fitness.com`:
- Self-contained (inline CSS, Google Fonts Inter)
- Sections: Nav, Hero (red gradient), Stats strip, Features (6 cards), Clubs (15 locations with GO24/ONYX brand dots), Download (App Store/Play Store badges), Footer
- Responsive (mobile + desktop)
- "Join Now" CTA — currently links to app download (web signup not yet built)

---

## Known Issues & TODOs

### Bugs
| # | Issue | Severity | File |
|---|-------|----------|------|
| 1 | Step counter inconsistent: selfie shows "3/4", startdate shows "3/5", payment shows "5/5" | Low | `selfie.tsx`, `startdate.tsx`, `payment.tsx` |
| 2 | `address` field always sent as empty string `''` from payment screen, ignoring Step 1 input | Medium | `payment.tsx` |

### Not Implemented
| # | Feature | Priority | Notes |
|---|---------|----------|-------|
| 1 | **Web Adyen payment** (`@adyen/adyen-web` Drop-In) | High | Need `payment.native.tsx` + `payment.web.tsx` split |
| 2 | **HTML "Join Now" → web signup** | High | Depends on #1 |
| 3 | **T&C real URL** | Medium | Currently hardcoded `https://go24fitness.com/terms` |
| 4 | **ONYX 2024 plan filtering** | Low | Some old 2024 plans may still appear |
| 5 | **Adyen webhook verification** | Medium | Verify Adyen payment server-side before PGM calls |

### Future Enhancements
- Email verification step before payment
- SMS OTP for phone verification
- Referral code / promo code support
- Multi-language i18n (currently English only)
- Adyen recurring payment setup for monthly billing
