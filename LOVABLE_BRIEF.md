# GO24 Fitness App — UI Brief for Lovable

## Project Overview

**App:** GO24 FITNESS — premium gym membership mobile app (Hong Kong)  
**Stack:** React Native + Expo SDK 54, TypeScript  
**Platform:** iOS + Android (Expo Go / EAS Build)  
**Goal:** Redesign all screens to premium fitness app quality — inspired by high-end fitness apps (Fitbody, Nike Training, etc.)

---

## Brand Identity

| Token | Value | Usage |
|-------|-------|-------|
| Primary Red | `#E8192C` | Buttons, active states, accents |
| Primary Mid | `#C8001F` | Gradient mid |
| Primary Dark | `#9A0018` | Gradient dark end, shadows |
| Primary Bg | `#FFF0F1` | Red tint background |
| CTA Orange | `#FF6B00` | Streak, special actions |
| Background | `#F4F4F8` | Screen background |
| Card | `#FFFFFF` | Card surfaces |
| Text | `#18181B` | Primary text |
| Text Muted | `#A1A1AA` | Secondary text |
| Border | `#EBEBF0` | Dividers |
| Success | `#22C55E` | Positive states |
| Error | `#EF4444` | Errors, destructive |

**Accent palette (for category icons):**
- Blue `#2563EB` / `#EFF6FF`
- Indigo `#4F46E5` / `#EEF2FF`
- Teal `#0891B2` / `#ECFEFF`
- Green `#16A34A` / `#F0FDF4`
- Amber `#D97706` / `#FFFBEB`
- Rose `#E11D48` / `#FFF1F2`

**Typography:** Inter (Black 900, Bold 700, SemiBold 600, Regular 400)

---

## Current Screen Inventory (7 screens to design)

### 1. LOGIN SCREEN (`/login`)
**Current:** Red gradient hero top + white form panel bottom  
**Desired:** Premium dark atmospheric feel OR keep split layout  
**Elements:**
- Full-screen background (dark gradient OR gym photo with overlay)
- GO24 logo + wordmark (large, top area)
- "Your Premium Fitness Journey" hero text
- "Move. Train. Perform." tagline
- White floating panel (bottom sheet style) with:
  - "Welcome back" title
  - Email input (pill shape, icon left)
  - Password input (pill shape, icon left, eye toggle right)
  - Forgot password link
  - "Sign In" CTA button (full-width, red gradient, pill shape)
  - Divider "or"
  - "Not a member? Join GO24 →" link

---

### 2. HOME SCREEN (`/`) — Main Dashboard
**Elements:**
- **Header:** Avatar (initials circle) + greeting + name + notification bell
- **Membership Card:** Red gradient card (credit card style, 200px tall)
  - GO24 FITNESS brand + Active/Inactive pill
  - Plan name + Member name (large)
  - Expires date + Days remaining + PT sessions left
  - Progress bar (days remaining / 365)
- **Alert bar:** Outstanding balance warning (red) or expiry warning (amber)
- **Streak banner:** Flame icon + "X-week streak" (orange accent)
- **THIS MONTH stats row:** 3 columns — Visits (red), PT (teal), Classes (indigo) — each with icon + big number
- **Smart Hub:** Card with cycling motivational/action hints (auto-rotates every 4s)
  - Urgent cards: credit card expired, outstanding balance, membership expired
  - Info cards: milestone progress, streak, PT sessions, monthly activity
- **Promotions:** Horizontal scroll banner (170px tall, with image)
- **Next Class card:** Left red stripe + class name + time + location
- **Quick Actions grid:** 2-col grid — Book Class, My Bookings, PT Sessions, Activity Log, QR Check-in

---

### 3. CLASSES SCREEN (`/classes`)
**Elements:**
- **Day picker:** 7-day horizontal scroll (Mon–Sun), active day = red pill
- **Filter sheet** (bottom modal):
  - Time slots: circle selectors with icon (Morning/Afternoon/Evening/Night)
  - Club selector: circle selectors with abbreviated name
  - Class type: circle selectors with abbreviated name
  - Active = red border + red tint background
- **Class list:** Each row shows:
  - Time (bold) + Duration
  - Class name (large) + Instructor
  - Club name
  - Live capacity: "X/Y booked" progress bar (fills red)
  - Book button (red, changes to "Cancel" if booked)
- **Live refresh:** Every 30 seconds, silent update

---

### 4. ACTIVITY SCREEN (`/activity`)
**Elements:**
- **Calendar heatmap:** Month view, dots indicate visit days (red = gym entry, indigo = class, teal = PT)
- **View toggle:** "This Month" / "All Time"
- **Summary cards:** Total visits, classes attended, PT sessions
- **Activity feed:** Chronological list of:
  - Class bookings (indigo icon)
  - PT sessions (teal icon)  
  - Gym check-ins (red/primary icon)
- **Club breakdown:** Which clubs visited, how many times

---

### 5. PT SCREEN (`/pt`)
**Elements:**
- Sessions remaining counter (prominent)
- Expiry date
- Session history list
- Book PT button

---

### 6. SETTINGS SCREEN (`/settings`) ✅ DONE
**Status:** Already migrated to component library  
**Elements:** Profile hero (avatar + name + member code badge), outstanding balance card (red), account details, saved card, navigation links, logout

---

### 7. NOTIFICATIONS SCREEN (`/notifications`)
**Elements:**
- List of push notifications
- Unread indicator
- Empty state

---

## Design System Components (already built in code)

| Component | Props |
|-----------|-------|
| `Button` | variant: primary/secondary/ghost/danger; size: sm/md/lg; loading; icon L/R; fullWidth |
| `Card` | onPress; padding; rounded; accentColor |
| `Input` | label; error; hint; icon; rightElement |
| `Avatar` | name (auto-initials); size: xs/sm/md/lg/xl |
| `Badge` | variant: success/warning/error/info/neutral/primary; dot; icon |
| `ListRow` | icon+iconColor+iconBg; label; sublabel; value; onPress; showChevron |
| `SectionHeader` | title; action |
| `EmptyState` | icon; title; subtitle; action |
| `ScreenHeader` | showBack; title; subtitle; rightIcon |
| `ScreenWrapper` | SafeAreaView + StatusBar wrapper |

---

## UX Rules (must follow)

1. **Touch targets:** Min 44×44pt all tappable elements
2. **No emoji icons** — use Ionicons only (outline = inactive, filled = active)
3. **Semantic colors** — use token names, not raw hex
4. **Tab bar:** 5 tabs max — Home, Classes, Activity, PT, Settings
5. **Loading states:** Skeleton or spinner for async operations
6. **Error states:** Inline below field (not toast-only)
7. **Destructive actions:** Red color, spatially separated, confirmation dialog
8. **Navigation:** Bottom tab bar (iOS style), back button on stack screens

---

## Navigation Structure

```
/(auth)
  login.tsx          — entry point (unauthenticated)
  
/(tabs)
  index.tsx          — Home (dashboard)
  classes.tsx        — Class schedule + booking
  activity.tsx       — Activity history + heatmap
  pt.tsx             — Personal training
  settings.tsx       — Profile + account
  
/membership          — Membership details
/payments/history    — Payment history
/payments/update-card — Card management
/checkin/qr          — QR code for gym entry
/favourites          — Favourite classes
/notifications       — Push notifications
```

---

## Key Data Flows

- **Dashboard API:** `GET /me/dashboard` → user, membership, PT, nextClass, thisMonth, streak, totalVisits
- **Classes API:** `GET /booking/classes/week` → 7 days of classes, cached 8s on backend
- **Live capacity:** Each class has `bookedCount` + `capacity`, refreshes every 30s
- **Book class:** `POST /booking/book/:classId`
- **Cancel booking:** `DELETE /booking/cancel/:bookingId`
- **Pay outstanding:** `POST /me/pay-outstanding`

---

## What Lovable Should Deliver

1. **Figma designs** for all 7 screens (mobile, 390×844px)
2. **Component specs** matching the existing token system
3. **Interaction states:** default, pressed, loading, error, empty
4. **Assets:** Any icons or illustrations as SVG

**Style inspiration:** Fitbody UI Kit, Nike Training Club, premium dark fitness aesthetic adapted to GO24's red brand color.
