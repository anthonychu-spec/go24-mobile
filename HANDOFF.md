# GO24 Fitness App — Session Handoff

> 每個新 chat session 貼 **[MASTER]** + 你要做的 **[FUNCTION BLOCK]**。

---

## [MASTER] — 每次都貼

```
GO24 Fitness Member App — NestJS + React Native (Expo)

REPO: C:\Users\LENOVO\Documents\Mobile App
  backend/nest-api/src/          → NestJS 11, TypeORM, PostgreSQL
  apps/member-app/app/           → Expo SDK 54, expo-router v4
  apps/member-app/src/           → shared: api/client.ts, auth/, theme/

STAGING API: https://api-staging.go24fitness.com/v1
DROPLET DEPLOY: cd /opt/go24 && git pull origin main && docker compose -f infra/droplet/docker-compose.prod.yml up -d --build api

THEME: bg=#F2F2F7, card=#FFFFFF, primary=#B5001E (red), cta=#FF6A00 (orange)
       text=#1C1C1E, textMuted=#8E8E93, error=#FF3B30, success=#34C759
FONTS: Inter via expo-google-fonts → fonts.regular / bold / semibold / black
ICONS: @expo/vector-icons Ionicons

AUTH: JWT (access 15m) + refresh token. apiClient auto-refreshes on 401.
      JWT payload: { sub: userId, pgmId, role, jti }
PGM:  Perfect Gym REST OData. PgmClient (circuit breaker + retry) lives in pgm-adapter/

KEY RULES:
- Platform.OS checks for native-only modules (Adyen, QR SVG, signature canvas)
- dynamic import() inside useEffect for native-only packages
- All TypeORM Column decorators need explicit type: 'varchar'/'int' etc.
- No circular imports. Check before injecting cross-module services.
- Always use Promise.allSettled for parallel PGM calls (PGM can be slow/fail)
```

---

## [FUNCTION BLOCKS] — 按需貼

---

### [AUTH] Login / JWT / Refresh

```
Files:
  backend: src/auth/ (auth.controller, auth.service, jwt.strategy, entities/user.entity)
  mobile:  app/(auth)/login.tsx, src/auth/context.tsx, src/auth/storage.ts

Flow:
  POST /auth/login → { accessToken, refreshToken }
  storage.ts: Platform.OS==='web' → localStorage, else expo-secure-store
  apiClient interceptor: auto-refresh on 401 via POST /auth/refresh

User entity fields: id(uuid), pgmMemberId(int), email, phone, role, status, memberCode

PGM auth: PgmAuthAdapter → POST /auth/token with member credentials
  On login: fetch PGM token → verify member → create/upsert User row → issue JWT
```

---

### [BOOKING] Class Booking + State Machine

```
Files:
  backend: src/bookings/ (booking.entity, bookings.service, bookings.controller)
           src/booking/  (booking.interfaces, pgm-booking.adapter)
  mobile:  app/(tabs)/classes.tsx, app/(tabs)/bookings.tsx

State machine: pending → confirmed | failed | waitlist | pending_verify
               confirmed → cancelled | attended | no_show

Idempotency: INSERT ON CONFLICT DO NOTHING (userId + classId unique index)
             Returns existing booking if duplicate attempt

PGM sync: PgmBookingAdapter.bookClass() → POST /odata/ClassBookings
          Reconcile cron (@nestjs/schedule v5) re-syncs pending bookings

API routes:
  GET  /bookings           → member's bookings list
  POST /bookings           → { classId } → book class
  DELETE /bookings/:id     → cancel booking

Mobile: classes.tsx fetches schedule from PGM OData, bookings.tsx shows state
```

---

### [PAYMENTS] Adyen Card Tokenisation

```
Files:
  backend: src/payments/ (adyen.client, payments.service, payments.controller,
                          entities/payment-method.entity)
  mobile:  app/payment/update-card.tsx (native), app/payment/update-card.web.tsx

Flow:
  1. GET /payments/card-session → Adyen session (amount=0, storePaymentMethod=true)
  2. Mobile: @adyen/react-native AdyenCheckout (native only, lazy import)
  3. Adyen webhook POST /payments/webhook → saves recurringDetailRef in payment_method table
  4. POST /me/pay-outstanding → AdyenClient.charge() with saved token (ContAuth)

payment_method entity: userId, shopperReference, recurringDetailRef, cardSummary,
                        cardBrand, expiryMonth, expiryYear, status (pending/active/failed)

AdyenClient methods: createSession(), charge(), verifyWebhookHmac()
PaymentsService: createCardSession(), handleWebhook(), getCard(), chargeOutstanding()

Env vars needed: ADYEN_API_KEY, ADYEN_MERCHANT_ACCOUNT, ADYEN_CLIENT_KEY,
                 ADYEN_ENVIRONMENT (TEST|LIVE), ADYEN_HMAC_KEY
```

---

### [CHECKIN] QR Code Check-in

```
Files:
  backend: src/checkin/ (checkin.controller, checkin.module)
  mobile:  app/checkin/qr.tsx

Flow:
  GET /checkin/qr → HMAC-SHA256 signed payload (30s TTL)
  Payload: "{userId}|{pgmId}|{expiresAt}|{nonce}|{sig16}"
  Signed with JWT_SECRET, sig = first 16 chars of HMAC hex

Mobile: react-native-qrcode-svg (native only, lazy import)
  - 30s countdown bar + auto-refresh interval
  - Web fallback: shows icon + text (no SVG on web)
  - Manual "Refresh Now" button

Staff side: scan QR → verify HMAC + expiry (not built yet in this app)
```

---

### [NOTIFICATIONS] Push + Entry Denial

```
Files:
  backend: src/notifications/ (notifications.service, notifications.controller,
                               entities/notification.entity, dto/)
  mobile:  app/(tabs)/notifications.tsx

Push: Expo Push API (direct HTTP to exp.host/--/api/v2/push/send)
  Device registers: POST /notifications/register → { expoPushToken }
  Send: NotificationsService.sendPush(userId, title, body, data)

Entry denial webhook (from n8n / Suprema BioStation 3):
  POST /notifications/entry-denied → { pgmMemberId, reason, timestamp }
  → looks up user by pgmMemberId → sends push "Entry denied: {reason}"

Notification inbox: GET /notifications → list, PATCH /notifications/:id/read
notification entity: userId, title, body, type, isRead, data(json), createdAt
```

---

### [PT] Personal Training Sessions + Signature

```
Files:
  backend: src/pt/ (pt.controller, pt.service, pt.module)
  mobile:  app/(tabs)/pt.tsx, app/pt/sign.tsx (native), app/pt/sign.web.tsx

PGM endpoints used:
  GET /odata/PtAgreements?$filter=memberId eq {pgmId}
  GET /odata/PtSessions?$filter=memberId eq {pgmId}

Flow:
  pt.tsx: lists remaining sessions + upcoming PT appointments
  sign.tsx: after PT session → member signs → POST /pt/sessions/:id/sign
            react-native-signature-canvas (native only, lazy import)
            Web fallback: message "Sign on mobile app"

PT agreement: { totalSessions, remainingSessions, endDate, trainerId }
```

---

### [ACTIVITY] Activity Log

```
Files:
  backend: src/activity/ (activity.controller, activity.service)
  mobile:  app/(tabs)/activity.tsx

Data sources (last 3 months):
  - Visits:   GET /odata/Visits?$filter=memberId eq {pgmId} and enterDate ge {date}
  - Classes:  local bookings table (status=attended)
  - PT:       GET /odata/PtSessions?$filter=memberId eq {pgmId}

API: GET /activity?months=3 → { visits:[], classes:[], pt:[], summary:{} }
summary: { totalVisits, totalClasses, totalPt, thisMonthVisits }

Mobile: unified timeline sorted by date, grouped by month
        summary bar at top showing totals
```

---

### [REFERRAL] Refer a Friend

```
Files:
  backend: src/referral/ (referral.controller, referral.service, entities/referral.entity)
  mobile:  app/referral.tsx

Flow:
  GET /referral/link → unique referral link (e.g. go24.fitness/join?ref=ABC123)
  Share via native Share sheet
  On new signup with ref code → POST /referral/convert (called by backend on user creation)
  Reward: 1 free month added to referrer's membership (manual or PGM update)

referral entity: referrerId(userId), refereeId(userId), code, status(pending/converted/rewarded),
                 convertedAt, rewardedAt

Mobile: shows referral link, share button, count of successful referrals
```

---

### [DASHBOARD + BANNERS] Home Screen Data

```
Files:
  backend: src/dashboard/ (dashboard.controller, dashboard.service, dashboard.module)
  mobile:  app/(tabs)/index.tsx

GET /me/dashboard returns:
  user: { name, email }
  membership: { active, planName, daysRemaining, expiresAt, outstandingBalance }
  pt: { remainingSessions, totalSessions, expiresAt }
  nextClass: { bookingId, classId, className, startTime, minutesUntil, clubName } | null
  thisMonth: { visits, classes, pt }
  unreadNotifications: number

GET /banners → [{ id, title, imageUrl, linkUrl }]
  Admin creates banners (no admin UI yet — direct DB insert or future admin panel)

DashboardModule imports: PgmModule, BookingModule, PaymentsModule
DashboardService injects: Booking repo, User repo, PgmClient, PaymentsService, IBookingRepo
```

---

### [PROFILE] My Account + Outstanding Balance

```
Files:
  backend: src/dashboard/ (same controller — routes under /me/)
  mobile:  app/profile.tsx

GET /me/profile returns:
  member: { pgmId, name, firstName, lastName, email, phone, memberCode }
  balance: { outstanding (HKD), currency, invoices:[{ id, description, amount, dueDate, status }] }
  savedCard: { brand, summary, expiryMonth, expiryYear } | null

POST /me/pay-outstanding:
  Server fetches LIVE outstanding from PGM Invoices (never trusts client amount)
  Charges saved Adyen card via AdyenClient.charge() (ContAuth)
  Returns: { success, pspReference, resultCode, amountCharged }

Mobile profile.tsx sections:
  - Avatar (initials from name)
  - Red balance card with invoice list + Pay Now button (if savedCard exists)
  - Green "No outstanding" if clear
  - Account details (email, phone)
  - Saved card row → /payment/update-card
  - Links: My Memberships, Update Card, Notifications, QR Check-in
  - Logout

Home screen (index.tsx): shows red alert banner if outstandingBalance > 0
                          My Account action in ACTIONS list with ⚠️ badge
```

---

### [MEMBERSHIP] Membership History

```
Files:
  backend: src/dashboard/dashboard.service.ts → getMemberships()
           GET /me/memberships
  mobile:  app/membership.tsx

Returns all contracts (current + ended) with:
  planName (from PaymentPlans lookup), clubName (from Clubs lookup),
  status, isActive, startDate, endDate, signUpDate, cancelDate, automaticRenew

Mobile: sections "CURRENT" / "ENDED", StatusBadge showing days left
        Active contract has red top bar + primary border
        Tappable from profile.tsx → /membership
```

---

### [TRAINER APP] — 未開始

```
Separate app: apps/trainer-app/ (未建)

Planned screens:
  Login          → same auth backend (/auth/login with role=trainer)
  Schedule       → GET /trainer/schedule (PT sessions for today/week)
  PT Log         → POST /trainer/sessions/:id/complete + member signs
  Commission     → GET /trainer/commission (monthly earnings from PGM)
  Face Enroll    → POST /trainer/members/:id/enroll-face (Suprema API proxy)

Backend needed:
  src/trainer/ module
  TrainerGuard: role==='trainer' check
  Suprema BioStation 3 API integration for face enrollment
```

---

## Quick Reference

### Git + Deploy
```bash
# Push changes
git add [files] && git commit -m "feat: ..." && git push origin main

# Deploy to staging Droplet
cd /opt/go24 && git pull origin main && \
docker compose -f infra/droplet/docker-compose.prod.yml up -d --build api && \
sleep 15 && docker logs go24-api --tail 20

# Run migration manually (if needed)
docker exec -it go24-db psql -U go24 -d go24 -c "SELECT 1"
docker exec go24-api node dist/database/run-migrations.js
```

### Common Patterns
```typescript
// Backend: PGM OData call (always allSettled)
const res = await this.pgm.get<{ value: any[] }>('/odata/Members', {
  $filter: `id eq ${pgmId}`,
  $select: 'id,firstName,lastName',
  $top: 1,
});

// Mobile: native-only lazy import
useEffect(() => {
  if (Platform.OS !== 'web') {
    import('react-native-qrcode-svg').then(mod => setComp(() => mod.default));
  }
}, []);

// Mobile: API call
const { data } = await apiClient.get<MyType>('/me/something');
```

### Known Gotchas
- `@adyen/react-native`, `react-native-signature-canvas`, `react-native-qrcode-svg` → native only, lazy import
- TypeORM Column: always add explicit `type: 'varchar'` etc. or TypeScript union types cause "Data type Object" error
- PGM circuit breaker opens after 50% failure → returns 503, don't panic
- JWT has no email field — fetch from DB or PGM Members endpoint if needed
- `expo-secure-store` crashes on web → use localStorage fallback
