# GO24 Member App — Feature Expansion Design Spec
**Date:** 2026-05-09  
**Status:** Awaiting review  
**Scope:** Member App (Expo) + NestJS backend

---

## Context

GO24 Fitness Member App replacing Perfect Gym Pro (PGM). Primary users are **group class attendees** (not solo gym-goers). Privacy-first — no social features. Core loop: browse classes → book → manage bookings.

---

## Section A — Class Experience

### A1. Favourite Classes
**Goal:** One-tap rebook of classes the member attends regularly.

- Member can ⭐ any class from the schedule or booking list
- Stored in `user_favourites` table: `(userId, classTemplateId, className, instructorName)`
- Home screen: "My Favourites" shortcut card → filtered schedule showing only favourite class types
- Favourite classes appear first in the class schedule list

**Backend:**
- `GET /me/favourites` → list
- `POST /me/favourites` → `{ classTemplateId, className }`
- `DELETE /me/favourites/:id`

---

### A2. Class Reminders
**Goal:** Push notification before each booked class.

- On booking confirmed → schedule Expo push notification
- Default: 1 hour before class
- Member can change in Settings: 30 min / 1 hour / 2 hours / off
- Stored in `user_settings` table: `reminderMinutes` (default: 60)
- Notification text: *"Your [Class Name] starts in 1 hour. See you there! 💪"*

**Backend:**
- `PATCH /me/settings` → `{ reminderMinutes: 30 | 60 | 120 | 0 }`
- Schedule push via `@nestjs/schedule` when booking is confirmed

---

### A3. Class History — Calendar Heatmap
**Goal:** Visual record of activity per day.

- Activity screen adds a **calendar heatmap view** toggle (existing list view stays)
- Each day coloured by activity count: none / light / medium / heavy
- Tap a day → shows visits, classes, PT for that day
- Data from: PGM Visits + bookings table (attended) + PtSessions

**No new API needed** — existing `GET /activity` data.

---

### A4. Streak
**Goal:** Motivate consistent attendance.

- Calculate: consecutive calendar weeks with at least 1 class or visit
- Displayed on Home screen stats row as 🔥 **X-week streak**
- Stored/cached in backend, recalculated on each visit sync
- Streak resets if a full calendar week passes with no activity

**Backend:**
- Add `streak: number` to `GET /me/dashboard` response
- Calculate from visits + bookings data

---

### A5. Waitlist Auto-Cancel (Optional)
**Goal:** Auto-release spot if confirmed too close to class time.

**User setting:** Toggle in Settings — *"Auto-cancel if waitlist confirmed less than 5 hours before class"*

**Flow:**
1. Cron job runs every 15 minutes
2. Finds bookings: `status = waitlist`, `classStartTime < now + 5h`
3. If member has `autoWaitlistCancel = true` in settings → cancel booking → notify member:
   *"Your waitlist spot for [Class] was released automatically. Your spot has been freed for the next person."*
4. If `autoWaitlistCancel = false` → send push: *"You're confirmed for [Class] in under 5 hours. Can you make it?"* (no auto action)

**Backend:**
- `user_settings`: add `autoWaitlistCancel: boolean` (default: false)
- New cron: `WaitlistReleaseCron` in bookings module

---

## Section B — Membership Self-Service (Logged In)

### B1. Freeze Request
**Goal:** Member requests membership freeze without calling the gym.

- Form: start date, end date (max 90 days), reason (dropdown: travel / medical / personal)
- Stored in `membership_requests` table: `{ userId, type: 'freeze', startDate, endDate, reason, status }`
- Status: `pending → approved / rejected`
- Member sees status in Profile screen
- Staff processes in admin panel (future)

**Backend:**
- `POST /me/membership/freeze-request`
- `GET /me/membership/requests` → list of requests + status

---

### B2. Payment History + Download Invoice
**Goal:** Member can see all charges and download PDF receipts.

- List of charges: date, amount, description, status
- Source: Adyen charge records stored in our DB + any PGM invoice data
- Each record has **Download Invoice** button → generates PDF receipt

**Backend:**
- `GET /me/payments` → `[{ id, date, amountHkd, description, status, invoiceAvailable }]`
- `GET /me/payments/:id/invoice` → returns PDF (generated server-side with pdfkit or similar)

**Mobile:**
- Payments list in Profile screen
- Download → native share sheet (expo-sharing) to save / email PDF

---

## Section B2 — New Member Signup (Pre-Login)

**Goal:** Non-members can join GO24, pay, and get instant access — all from the app.

### Flow (4 steps)

```
Login screen
  └── [Not a member? Join GO24 →]

Step 1: Personal Details
  - First name, last name, email, phone, date of birth

Step 2: Choose Plan
  - Fetched from PGM PaymentPlans (no auth required, public endpoint)
  - Show: name, price/month, features
  - Member selects plan

Step 3: Take Selfie (Face ID)
  - Camera opens (expo-camera)
  - Member takes photo
  - Uploaded to backend with signup form

Step 4: Payment (Adyen)
  - Adyen Drop-In for first payment
  - On success:
    → Create PGM member via PGM API
    → Create PGM contract (selected plan)
    → Create user record in our DB
    → Issue JWT → auto-login
    → POST face photo to Suprema BioStation 3 API (async)
    → Send welcome push: "Welcome! Your Face ID is being activated..."
```

### Face ID Webhook Flow
```
Backend → Suprema API (enroll face)
Suprema processes...
Suprema → POST /webhooks/suprema/enroll → our backend
  Success: update face_enrollments.status = 'enrolled'
           push notification: "✅ Face ID activated — you can now enter GO24"
  Failure: update face_enrollments.status = 'failed'
           push notification: "❌ Face ID failed — please retake your photo"
           Member can retake photo from Profile screen → retry enrollment
```

### Backend — New endpoints (no auth guard)
- `GET /public/plans` → list of PGM PaymentPlans
- `POST /public/signup` → `{ personalDetails, planId, facePhotoBase64, adyenPaymentData }`
  - Creates PGM member + contract
  - Processes Adyen payment
  - Submits face to Suprema async
  - Returns `{ accessToken, refreshToken }`
- `POST /webhooks/suprema/enroll` → Suprema callback (HMAC verified)

### Notes
- Member can enter via QR Check-in immediately after signup
- Face ID activates automatically once Suprema webhook confirms
- Failure handling: if PGM creation fails → refund Adyen charge automatically
- If face enrollment fails → member can retake photo from Profile → retry

---

## Section C — Data & Monthly Summary

### C1. Monthly Summary Push Notification
**Goal:** Monthly recap to keep members engaged.

- Cron: 1st of every month, 9 AM HKT
- Push to all active members: *"Last month you visited X times, attended Y classes, Z PT sessions. Great work! 💪"*
- Tapping notification → opens Activity screen filtered to last month

---

### C2. Milestones (Achievements)
**Goal:** Celebrate attendance consistency.

**Milestone levels:**
| Visits | Badge | Message |
|--------|-------|---------|
| 10 | 🥉 First Steps | "You've visited GO24 10 times!" |
| 50 | 🥈 Regular | "50 visits — you're a GO24 regular!" |
| 100 | 🥇 Centurion | "100 visits — incredible commitment!" |
| 200 | 💎 Legend | "200 visits — you're a GO24 legend!" |

- Checked on every visit sync
- Push notification when milestone hit
- Badges displayed on Profile screen
- Stored in `member_milestones` table: `{ userId, milestone, unlockedAt }`

**Backend:**
- `GET /me/milestones` → list of earned milestones
- Milestone check runs inside visit sync logic

---

### C3. Activity Calendar (Heatmap)
**Goal:** Visual overview of activity over time.

- Calendar grid (GitHub-style heatmap) on Activity screen
- Toggle between **List view** and **Calendar view**
- Colour scale: grey (0) → light red (1) → medium red (2+) → deep red (3+)
- Tap any day → bottom sheet showing that day's visits / classes / PT
- Date range: last 6 months visible by default

**No new API** — data from existing `GET /activity` endpoint.

---

## Database Changes Required

| Table | Change |
|-------|--------|
| `user_favourites` | New: userId, classTemplateId, className, instructorName |
| `user_settings` | New: userId, reminderMinutes, autoWaitlistCancel |
| `membership_requests` | New: userId, type, startDate, endDate, reason, status |
| `member_milestones` | New: userId, milestone, unlockedAt |
| `payments` | New: userId, amountHkd, description, adyenRef, pdfPath, createdAt |
| `face_enrollments` | New: userId, photoPath, status (pending/enrolled/failed), supremaRef, enrolledAt |

---

## Implementation Priority

| Priority | Feature | Effort |
|----------|---------|--------|
| 🔴 High | B2 New Member Signup | Large |
| 🔴 High | A2 Class Reminders | Small |
| 🟡 Medium | A1 Favourites | Medium |
| 🟡 Medium | B2 Payment History + Invoice | Medium |
| 🟡 Medium | C1 Monthly Summary push | Small |
| 🟢 Low | A4 Streak | Small |
| 🟢 Low | A5 Waitlist Auto-cancel | Medium |
| 🟢 Low | C2 Milestones | Medium |
| 🟢 Low | A3 + C3 Calendar Heatmap | Medium |
| 🟢 Low | B1 Freeze Request | Medium |

---

## Out of Scope (This Spec)
- Section D (Smart Hub) — not yet defined, separate spec
- Admin panel for banner management — separate session
- Trainer app — separate project
- Social features — explicitly excluded
