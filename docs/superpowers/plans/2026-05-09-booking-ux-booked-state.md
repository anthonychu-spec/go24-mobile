# Booking UX — Day Booking Banner

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a prominent banner at the top of the classes list telling the user exactly which class they've booked (or waitlisted) for the selected day, and lock all other classes.

**Architecture:** Upgrade `bookedDays: Set<string>` → `dayBookings: Map<string, DayBooking>` to track classId + status + class details per day. Add a `DayBookingBanner` component rendered as the FlatList `ListHeaderComponent`. ClassRow receives a simple `locked: boolean` prop — if another class is booked that day, the row is locked. No backend changes required.

**Tech Stack:** React Native, Expo, TypeScript — `apps/member-app/app/(tabs)/classes.tsx` only.

---

## Target UX

```
┌─ Today, 9 May 2026 ──────────── Live · 12:03 ─┐

│ ✓  BODYPUMP · 12:00 – 13:00          Cancel  │  ← green banner (confirmed)
│    📍 ONYX Central                           │
└───────────────────────────────────────────────┘

  07:00  Hatha Yoga            [🔒 1/1]
  10:00  TRX                   [🔒 1/1]
  12:00  BODYPUMP              [🔒 1/1]   ← the booked class itself also locked
  19:00  Foundation Reformer   [🔒 1/1]

── or if waitlisted ───────────────────────────

│ ⏳ Waitlist: Foundation Reformer · 19:00     │  ← purple banner
│    📍 ONYX Admiralty  ·  You're on the list  │
└───────────────────────────────────────────────┘
```

---

## File Structure

**Single file touched:**
- Modify: `apps/member-app/app/(tabs)/classes.tsx`
  - Add `DayBooking` interface
  - Change state: `bookedDays: Set<string>` → `dayBookings: Map<string, DayBooking>`
  - Update `fetchBookedDays` to build Map with classId, status, className, clubName, startTime, endTime
  - Add `DayBookingBanner` component
  - Update `ClassRow`: replace `dayBooked: boolean` with `locked: boolean`
  - Wire banner into FlatList `ListHeaderComponent`
  - Add styles: `banner`, `bannerBooked`, `bannerWaitlist`, `bannerTitle`, `bannerSub`, `bannerCancel`

---

## Tasks

### Task 1: Add `DayBooking` type and upgrade state

**Files:**
- Modify: `apps/member-app/app/(tabs)/classes.tsx`

- [ ] **Step 1: Add `DayBooking` interface** after the existing `BookResult` interface

```tsx
interface DayBooking {
  bookingId: string;
  classId: number;
  status: 'confirmed' | 'pending' | 'waitlist' | 'pending_verify';
  className: string;
  clubName: string | null;
  startTime: string;
  endTime: string;
}
```

- [ ] **Step 2: Replace state declaration** in `ClassesScreen`

Find:
```tsx
const [bookedDays, setBookedDays] = useState<Set<string>>(new Set());
```
Replace with:
```tsx
const [dayBookings, setDayBookings] = useState<Map<string, DayBooking>>(new Map());
```

- [ ] **Step 3: Check TypeScript**

```bash
cd "C:\Users\LENOVO\Documents\Mobile App"
npx tsc --noEmit -p apps/member-app/tsconfig.json 2>&1 | grep classes
```

Expected: errors on `bookedDays` usages (fixed in later tasks).

- [ ] **Step 4: Commit**

```bash
git add apps/member-app/app/(tabs)/classes.tsx
git commit -m "feat(classes): add DayBooking type, upgrade state to Map"
```

---

### Task 2: Update `fetchBookedDays` to build the Map

**Files:**
- Modify: `apps/member-app/app/(tabs)/classes.tsx` — `fetchBookedDays` function

- [ ] **Step 1: Replace function body**

Find:
```tsx
const fetchBookedDays = useCallback(async () => {
  try {
    const { data } = await apiClient.get<any[]>('/bookings');
    const days = new Set<string>();
    for (const b of data) {
      if (!['confirmed', 'pending', 'waitlist', 'pending_verify'].includes(b.status)) continue;
      const st = b.startTime ?? b.createdAt;
      if (st) days.add(new Date(st).toISOString().slice(0, 10));
    }
    setBookedDays(days);
  } catch { /* ignore */ }
}, []);
```

Replace with:
```tsx
const fetchBookedDays = useCallback(async () => {
  try {
    const { data } = await apiClient.get<any[]>('/bookings');
    const map = new Map<string, DayBooking>();
    for (const b of data) {
      if (!['confirmed', 'pending', 'waitlist', 'pending_verify'].includes(b.status)) continue;
      const st = b.startTime ?? b.createdAt;
      if (!st || !b.classId) continue;
      const dateKey = new Date(st).toISOString().slice(0, 10);
      // Prefer confirmed/pending over waitlist if two entries for same day
      const existing = map.get(dateKey);
      if (!existing || existing.status === 'waitlist') {
        map.set(dateKey, {
          bookingId: b.id,
          classId:   b.classId,
          status:    b.status,
          className: b.className ?? `Class #${b.classId}`,
          clubName:  b.clubName ?? null,
          startTime: b.startTime,
          endTime:   b.endTime,
        });
      }
    }
    setDayBookings(map);
  } catch { /* ignore */ }
}, []);
```

- [ ] **Step 2: Check TypeScript**

```bash
cd "C:\Users\LENOVO\Documents\Mobile App"
npx tsc --noEmit -p apps/member-app/tsconfig.json 2>&1 | grep classes
```

- [ ] **Step 3: Commit**

```bash
git add apps/member-app/app/(tabs)/classes.tsx
git commit -m "feat(classes): fetchBookedDays tracks classId, status, name, times"
```

---

### Task 3: Add `DayBookingBanner` component

**Files:**
- Modify: `apps/member-app/app/(tabs)/classes.tsx` — add component before `ClassRow`

- [ ] **Step 1: Add the component** (place it just before the `/* ── Class row ── */` comment)

```tsx
/* ── Day booking banner ── */
function DayBookingBanner({
  booking,
  onCancel,
  cancelling,
}: {
  booking: DayBooking;
  onCancel: (bookingId: string) => void;
  cancelling: boolean;
}) {
  const isWaitlist = booking.status === 'waitlist';
  const timeRange = `${fmtTime(booking.startTime)} – ${fmtTime(booking.endTime)}`;

  return (
    <View style={[bn.wrap, isWaitlist ? bn.wrapWaitlist : bn.wrapBooked]}>
      <View style={bn.iconWrap}>
        <Ionicons
          name={isWaitlist ? 'time' : 'checkmark-circle'}
          size={22}
          color={isWaitlist ? '#8B5CF6' : colors.success}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={bn.title} numberOfLines={1}>
          {isWaitlist ? 'Waitlist: ' : ''}{booking.className}
        </Text>
        <Text style={bn.sub}>
          {timeRange}{booking.clubName ? `  ·  ${booking.clubName}` : ''}
        </Text>
      </View>
      <Pressable
        onPress={() => onCancel(booking.bookingId)}
        disabled={cancelling}
        hitSlop={8}
        style={bn.cancelBtn}
      >
        {cancelling
          ? <ActivityIndicator size="small" color={colors.error} />
          : <Text style={bn.cancelText}>Cancel</Text>
        }
      </Pressable>
    </View>
  );
}

const bn = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginVertical: 8,
    padding: 12, borderRadius: 12, borderWidth: 1,
  },
  wrapBooked: {
    backgroundColor: colors.success + '12',
    borderColor: colors.success + '40',
  },
  wrapWaitlist: {
    backgroundColor: '#8B5CF612',
    borderColor: '#8B5CF640',
  },
  iconWrap:   { width: 28, alignItems: 'center' },
  title:      { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  sub:        { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 1 },
  cancelBtn:  { paddingHorizontal: 8, paddingVertical: 4 },
  cancelText: { fontSize: 12, fontFamily: fonts.semibold, color: colors.error },
});
```

- [ ] **Step 2: Check TypeScript**

```bash
cd "C:\Users\LENOVO\Documents\Mobile App"
npx tsc --noEmit -p apps/member-app/tsconfig.json 2>&1 | grep classes
```

- [ ] **Step 3: Commit**

```bash
git add apps/member-app/app/(tabs)/classes.tsx
git commit -m "feat(classes): add DayBookingBanner component"
```

---

### Task 4: Update `ClassRow`, wire banner, add cancel logic

**Files:**
- Modify: `apps/member-app/app/(tabs)/classes.tsx` — ClassRow props, FlatList, ClassesScreen state

- [ ] **Step 1: Update `ClassRow` prop — replace `dayBooked` with `locked`**

Find:
```tsx
function ClassRow({ item, onBook, isBooking, dayBooked }: {
  item: GymClass;
  onBook: (id: number, waitlist: boolean) => void;
  isBooking: boolean;
  dayBooked: boolean;
}) {
```

Replace with:
```tsx
function ClassRow({ item, onBook, isBooking, locked }: {
  item: GymClass;
  onBook: (id: number, waitlist: boolean) => void;
  isBooking: boolean;
  locked: boolean;   // true when a booking already exists for this day
}) {
```

- [ ] **Step 2: Update button logic inside `ClassRow`**

Find:
```tsx
      ) : dayBooked && !full ? (
        <View style={s.bookBtnLocked}>
          <Ionicons name="checkmark" size={14} color={colors.success} />
          <Text style={[s.lockedText, { color: colors.success }]}>1/1</Text>
        </View>
      ) : (
        <Pressable
          style={[s.bookBtn, full ? s.bookBtnFull : dayBooked ? s.bookBtnFull : s.bookBtnAvail, isBooking && s.bookBtnLoading]}
```

Replace with:
```tsx
      ) : locked ? (
        <View style={s.bookBtnLocked}>
          <Ionicons name="checkmark" size={14} color={colors.success} />
          <Text style={[s.lockedText, { color: colors.success }]}>1/1</Text>
        </View>
      ) : (
        <Pressable
          style={[s.bookBtn, full ? s.bookBtnFull : s.bookBtnAvail, isBooking && s.bookBtnLoading]}
```

- [ ] **Step 3: Add `cancellingBanner` state** to `ClassesScreen` (after the existing state declarations)

```tsx
const [cancellingBanner, setCancellingBanner] = useState(false);
```

- [ ] **Step 4: Add `handleBannerCancel` function** (after `handleBook`)

```tsx
async function handleBannerCancel(bookingId: string) {
  setCancellingBanner(true);
  try {
    await apiClient.delete(`/bookings/${bookingId}`, {
      headers: { 'idempotency-key': generateUUID() },
    });
    await Promise.all([fetchBookedDays(), fetchWeek(true)]);
  } catch {
    setToast('Failed to cancel. Please try again.');
    setTimeout(() => setToast(''), 4000);
  } finally { setCancellingBanner(false); }
}
```

- [ ] **Step 5: Update the FlatList** — add banner to `ListHeaderComponent` and fix `renderItem`

Find:
```tsx
          ListHeaderComponent={
            <View style={s.dateHeader}>
              <Text style={s.dateHeaderText}>{dateLabel}</Text>
              <Text style={s.liveLabel}>
                <Ionicons name="radio-button-on" size={10} color={colors.success} />
                {' '}{liveLabel}
              </Text>
            </View>
          }
```

Replace with:
```tsx
          ListHeaderComponent={
            <>
              <View style={s.dateHeader}>
                <Text style={s.dateHeaderText}>{dateLabel}</Text>
                <Text style={s.liveLabel}>
                  <Ionicons name="radio-button-on" size={10} color={colors.success} />
                  {' '}{liveLabel}
                </Text>
              </View>
              {dayBookings.has(dayKey) && (
                <DayBookingBanner
                  booking={dayBookings.get(dayKey)!}
                  onCancel={handleBannerCancel}
                  cancelling={cancellingBanner}
                />
              )}
            </>
          }
```

- [ ] **Step 6: Update `renderItem`** to pass `locked` instead of `dayBooked`

Find:
```tsx
          renderItem={({ item }) => (
            <ClassRow item={item} onBook={handleBook} isBooking={bookingId === item.id} dayBooked={bookedDays.has(dayKey)} />
          )}
```

Replace with:
```tsx
          renderItem={({ item }) => (
            <ClassRow
              item={item}
              onBook={handleBook}
              isBooking={bookingId === item.id}
              locked={dayBookings.has(dayKey)}
            />
          )}
```

- [ ] **Step 7: Verify zero TypeScript errors in classes.tsx**

```bash
cd "C:\Users\LENOVO\Documents\Mobile App"
npx tsc --noEmit -p apps/member-app/tsconfig.json 2>&1 | grep classes
```

Expected: no output.

- [ ] **Step 8: Final commit**

```bash
git add apps/member-app/app/(tabs)/classes.tsx
git commit -m "feat(classes): day booking banner with cancel, lock all other classes"
```
