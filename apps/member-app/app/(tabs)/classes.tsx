import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator, FlatList, Modal, Pressable,
  RefreshControl, ScrollView, SectionList, StatusBar, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../src/api/client';
import { colors, statusBarStyle } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';

interface GymClass {
  id: number; name: string; startTime: string; endTime: string;
  clubId: number; clubName: string | null; instructorName: string | null;
  maxParticipants: number; participantsCount: number;
  standbyListLimit?: number;
  isWaitlist: boolean; isCancelled: boolean;
}

interface DayBooking {
  bookingId: string;
  classId: number;
  status: 'confirmed' | 'pending' | 'waitlist' | 'pending_verify';
  className: string;
  clubName: string | null;
  startTime: string;
  endTime: string;
  instructorName?: string | null;
}

// What we show in the confirmation modal
interface ConfirmResult {
  bookingId: string;
  status: string;
  className: string;
  startTime: string;
  endTime: string;
  clubName: string | null;
  instructorName: string | null;
}

type TimeSlot = 'all' | 'morning' | 'afternoon' | 'evening';

interface Filters {
  availableOnly: boolean;
  timeSlot: TimeSlot;
  classTypes: string[];   // multi-select
  clubIds: number[];      // multi-select
}

const DEFAULT_FILTERS: Filters = { availableOnly: false, timeSlot: 'all', classTypes: [], clubIds: [] };
const FILTERS_STORAGE_KEY = 'go24:classFilters';
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const LIVE_REFRESH_FAST_MS   = 10_000;
const LIVE_REFRESH_NORMAL_MS = 30_000;
const LIVE_REFRESH_SLOW_MS   = 60_000;
const BOOKING_WINDOW_H = 168;
const DISPLAY_DAYS = 14;        // show 14 days (336h)
const RUSH_CLASS_KEYWORDS = ['reformer', 'bodypump', 'bodycombat', 'hiit'];
const PEAK_HOURS = [[11, 14], [18, 21]] as const;

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('en-HK', { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return iso; }
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-HK', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch { return ''; }
}

function durationMin(start: string, end: string) {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

function getHour(iso: string) { return new Date(iso).getHours(); }

function bookingWindowStatus(startTime: string): { bookable: boolean; opensIn?: string } {
  const now = Date.now();
  const start = new Date(startTime).getTime();
  const cutoff = now + BOOKING_WINDOW_H * 3600_000;
  if (start <= cutoff) return { bookable: true };
  const diffH = Math.ceil((start - cutoff) / 3600_000);
  return { bookable: false, opensIn: diffH >= 24 ? `${Math.floor(diffH / 24)}d` : `${diffH}h` };
}

function buildDays(count = 7) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i); return d;
  });
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function applyFilters(classes: GymClass[], search: string, filters: Filters): GymClass[] {
  return classes.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filters.availableOnly && c.participantsCount >= c.maxParticipants) return false;
    if (filters.classTypes.length > 0 && !filters.classTypes.includes(c.name)) return false;
    if (filters.clubIds.length > 0 && !filters.clubIds.includes(c.clubId)) return false;
    if (filters.timeSlot !== 'all') {
      const h = getHour(c.startTime);
      if (filters.timeSlot === 'morning'   && h >= 12) return false;
      if (filters.timeSlot === 'afternoon' && (h < 12 || h >= 17)) return false;
      if (filters.timeSlot === 'evening'   && h < 17) return false;
    }
    return true;
  });
}

function activeFilterCount(f: Filters) {
  let n = 0;
  if (f.availableOnly) n++;
  if (f.timeSlot !== 'all') n++;
  n += f.classTypes.length;
  n += f.clubIds.length;
  return n;
}

function getClassOptions(classes: GymClass[]) {
  const typeSet = new Map<string, string>();
  const clubSet = new Map<number, string>();
  for (const c of classes) {
    if (c.name) typeSet.set(c.name, c.name);
    if (c.clubId && c.clubName) clubSet.set(c.clubId, c.clubName);
  }
  return {
    classTypes: Array.from(typeSet.values()).sort(),
    clubs: Array.from(clubSet.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/* ── Capacity pips (5-dot indicator) ── */
function CapacityPips({ filled, total }: { filled: number; total: number }) {
  if (total <= 0) return null;
  const pct = filled / total;
  const full = pct >= 1;
  const dotColor = full ? colors.error : pct >= 0.8 ? colors.cta : colors.success;
  const filledPips = full ? 5 : Math.round(pct * 5);
  return (
    <View style={cb.wrap}>
      {Array.from({ length: 5 }, (_, i) => (
        <View key={i} style={[cb.pip, { backgroundColor: i < filledPips ? dotColor : colors.bg }]} />
      ))}
      <Text style={[cb.label, { color: full ? colors.error : colors.textMuted }]}>
        {full ? 'Full' : `${filled}/${total}`}
      </Text>
    </View>
  );
}
const cb = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  pip:   { width: 10, height: 6, borderRadius: 3 },
  label: { fontSize: 10, fontFamily: fonts.bold, marginLeft: 4, color: colors.textMuted },
});

/* ── Day booking banner ── */
function DayBookingBanner({
  booking, onCancel, cancelling,
}: {
  booking: DayBooking;
  onCancel: (bookingId: string) => void;
  cancelling: boolean;
}) {
  const isWaitlist = booking.status === 'waitlist';
  return (
    <View style={[bn.wrap, isWaitlist ? bn.wrapWaitlist : bn.wrapBooked]}>
      <View style={bn.iconCol}>
        <Ionicons
          name={isWaitlist ? 'time' : 'checkmark-circle'}
          size={28}
          color={isWaitlist ? '#8B5CF6' : colors.success}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={bn.label}>{isWaitlist ? 'WAITLIST' : 'BOOKED'}</Text>
        <Text style={bn.name} numberOfLines={1}>{booking.className}</Text>
        <Text style={bn.meta}>
          {fmtTime(booking.startTime)} – {fmtTime(booking.endTime)}
          {booking.clubName ? `  ·  ${booking.clubName}` : ''}
        </Text>
      </View>
      <Pressable onPress={() => onCancel(booking.bookingId)} disabled={cancelling} hitSlop={10} style={bn.cancelBtn}>
        {cancelling
          ? <ActivityIndicator size="small" color={colors.error} />
          : <Text style={bn.cancelText}>Cancel</Text>}
      </Pressable>
    </View>
  );
}
const bn = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 12, marginTop: 10, marginBottom: 4,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  wrapBooked:   { backgroundColor: colors.success + '12', borderColor: colors.success + '50' },
  wrapWaitlist: { backgroundColor: '#8B5CF612', borderColor: '#8B5CF650' },
  iconCol:      { alignItems: 'center', justifyContent: 'center', width: 32 },
  label:        { fontSize: 10, fontFamily: fonts.bold, letterSpacing: 1, color: colors.textMuted },
  name:         { fontSize: 15, fontFamily: fonts.black, color: colors.text },
  meta:         { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted },
  cancelBtn:    { paddingHorizontal: 8, paddingVertical: 6 },
  cancelText:   { fontSize: 13, fontFamily: fonts.semibold, color: colors.error },
});

/* ── Filter sheet — Figma circle-selector pattern ── */

// Circle option item (Level/Type style from Figma kit)
function CircleOption({
  icon, label, active, onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={fs.circleWrap} onPress={onPress}>
      <View style={[fs.circle, active && fs.circleActive]}>
        <Ionicons name={icon} size={26} color={active ? colors.primary : colors.textMuted} />
      </View>
      <Text style={[fs.circleLabel, active && fs.circleLabelActive]}>{label}</Text>
    </Pressable>
  );
}

// Text-only circle (for clubs / class types)
function TextCircle({
  label, active, onPress,
}: {
  label: string; active: boolean; onPress: () => void;
}) {
  // Abbreviate long names: "GO24 Fitness Wong Tai Sin" → "WTS"
  const abbr = label
    .replace(/go24\s+fitness\s*/i, '')
    .replace(/onyx\s+by\s+go24\s*/i, 'ONYX ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    || label.slice(0, 2).toUpperCase();

  // Short label for below circle
  const short = label.length > 14
    ? label.replace(/go24\s+fitness\s*/i, '').replace(/onyx\s+by\s+go24\s*/i, 'ONYX ').trim()
    : label;

  return (
    <Pressable style={fs.circleWrap} onPress={onPress}>
      <View style={[fs.circle, active && fs.circleActive]}>
        <Text style={[fs.circleAbbr, active && fs.circleAbbrActive]}>{abbr}</Text>
      </View>
      <Text style={[fs.circleLabel, active && fs.circleLabelActive]} numberOfLines={2}>{short}</Text>
    </Pressable>
  );
}

function FilterSheet({
  visible, filters, allClasses, onApply, onClose, onSaveDefault,
}: {
  visible: boolean; filters: Filters; allClasses: GymClass[];
  onApply: (f: Filters) => void; onClose: () => void;
  onSaveDefault: (f: Filters) => void;
}) {
  const [draft, setDraft] = useState(filters);
  useEffect(() => { if (visible) setDraft(filters); }, [visible]);
  const { classTypes, clubs } = getClassOptions(allClasses);

  function toggleClassType(ct: string) {
    setDraft(d => ({
      ...d,
      classTypes: d.classTypes.includes(ct)
        ? d.classTypes.filter(x => x !== ct)
        : [...d.classTypes, ct],
    }));
  }

  function toggleClub(id: number) {
    setDraft(d => ({
      ...d,
      clubIds: d.clubIds.includes(id)
        ? d.clubIds.filter(x => x !== id)
        : [...d.clubIds, id],
    }));
  }

  const TIME_SLOTS: { key: TimeSlot; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { key: 'all',       label: 'All day',   icon: 'time-outline' },
    { key: 'morning',   label: 'Morning',   icon: 'sunny-outline' },
    { key: 'afternoon', label: 'Afternoon', icon: 'partly-sunny-outline' },
    { key: 'evening',   label: 'Evening',   icon: 'moon-outline' },
  ];

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={fs.overlay} onPress={onClose} />
      <View style={fs.sheet}>
        <View style={fs.handle} />

        {/* Header */}
        <View style={fs.header}>
          <Text style={fs.title}>Filter Classes</Text>
          <Pressable onPress={() => { setDraft(DEFAULT_FILTERS); onApply(DEFAULT_FILTERS); onClose(); }}
            hitSlop={10}>
            <Text style={fs.reset}>Reset</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={fs.scrollContent}>

          {/* Available only toggle */}
          <View style={fs.toggleRow}>
            <View style={fs.toggleLeft}>
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
              <Text style={fs.toggleLabel}>Available spots only</Text>
            </View>
            <Switch value={draft.availableOnly}
              onValueChange={v => setDraft(d => ({ ...d, availableOnly: v }))}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#fff" />
          </View>

          {/* ── Time of day — circles ── */}
          <View style={fs.section}>
            <View style={fs.sectionHeader}>
              <Text style={fs.sectionTitle}>Time</Text>
            </View>
            <View style={fs.circleRow}>
              {TIME_SLOTS.map(ts => (
                <CircleOption
                  key={ts.key}
                  icon={ts.icon}
                  label={ts.label}
                  active={draft.timeSlot === ts.key}
                  onPress={() => setDraft(d => ({ ...d, timeSlot: ts.key }))}
                />
              ))}
            </View>
          </View>

          {/* ── Club — circles ── */}
          {clubs.length > 0 && (
            <View style={fs.section}>
              <View style={fs.sectionHeader}>
                <Text style={fs.sectionTitle}>Club</Text>
                {draft.clubIds.length > 0 && (
                  <Text style={fs.sectionCount}>{draft.clubIds.length} selected</Text>
                )}
              </View>
              <View style={fs.circleRow}>
                {clubs.map(club => (
                  <TextCircle
                    key={club.id}
                    label={club.name}
                    active={draft.clubIds.includes(club.id)}
                    onPress={() => toggleClub(club.id)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* ── Class type — circles ── */}
          {classTypes.length > 0 && (
            <View style={fs.section}>
              <View style={fs.sectionHeader}>
                <Text style={fs.sectionTitle}>Class type</Text>
                {draft.classTypes.length > 0 && (
                  <Text style={fs.sectionCount}>{draft.classTypes.length} selected</Text>
                )}
              </View>
              <View style={fs.circleRow}>
                {classTypes.map(ct => (
                  <TextCircle
                    key={ct}
                    label={ct}
                    active={draft.classTypes.includes(ct)}
                    onPress={() => toggleClassType(ct)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Save as default */}
          <Pressable style={fs.saveBtn} onPress={() => onSaveDefault(draft)}>
            <Ionicons name="bookmark-outline" size={14} color={colors.textMuted} />
            <Text style={fs.saveBtnText}>Save as my default</Text>
          </Pressable>
        </ScrollView>

        {/* Apply CTA */}
        <Pressable style={fs.applyBtn} onPress={() => { onApply(draft); onClose(); }}>
          <Text style={fs.applyText}>
            Show Results{activeFilterCount(draft) > 0 ? `  ·  ${activeFilterCount(draft)} filter${activeFilterCount(draft) > 1 ? 's' : ''} on` : ''}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const CIRCLE_SIZE = 72;

const fs = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 36,
    position: 'absolute', bottom: 0, left: 0, right: 0,
    maxHeight: '82%',
  },
  handle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title:   { fontSize: 20, fontFamily: fonts.black, color: colors.text },
  reset:   { fontSize: 14, fontFamily: fonts.semibold, color: colors.primary },

  scrollContent: { paddingBottom: 8, gap: 4 },

  toggleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, marginBottom: 4 },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleLabel:{ fontSize: 15, fontFamily: fonts.regular, color: colors.text },

  section:       { marginTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle:  { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  sectionCount:  { fontSize: 13, fontFamily: fonts.semibold, color: colors.primary },

  // Circle grid — 4 across for time, wraps for clubs/types
  circleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  circleWrap:  { alignItems: 'center', width: CIRCLE_SIZE, gap: 8 },
  circle: {
    width: CIRCLE_SIZE, height: CIRCLE_SIZE, borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1.5, borderColor: colors.border,
  },
  circleActive: {
    borderColor: colors.primary, borderWidth: 2,
    backgroundColor: colors.primaryBg,
  },
  circleLabel:       { fontSize: 11, fontFamily: fonts.regular, color: colors.textMuted, textAlign: 'center', lineHeight: 14 },
  circleLabelActive: { fontFamily: fonts.semibold, color: colors.primary },
  circleAbbr:        { fontSize: 18, fontFamily: fonts.black, color: colors.textMuted },
  circleAbbrActive:  { color: colors.primary },

  saveBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: 16, marginTop: 8 },
  saveBtnText: { fontSize: 13, fontFamily: fonts.regular, color: colors.textMuted },

  applyBtn: {
    backgroundColor: colors.primary, borderRadius: 999,
    height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 16,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  applyText: { color: '#fff', fontSize: 15, fontFamily: fonts.bold, letterSpacing: 0.3 },
});

/* ── Timeline row (with left rail + dot node) ── */
function ClassRow({ item, onBook, isBooking, locked }: {
  item: GymClass;
  onBook: (id: number, waitlist: boolean) => void;
  isBooking: boolean;
  locked: boolean;
}) {
  const full = item.participantsCount >= item.maxParticipants;
  const pct  = item.maxParticipants > 0 ? item.participantsCount / item.maxParticipants : 0;
  const dur  = durationMin(item.startTime, item.endTime);
  const { bookable, opensIn } = bookingWindowStatus(item.startTime);
  const dotColor = full ? colors.textMuted : pct >= 0.8 ? colors.cta : colors.success;

  return (
    <View style={[s.classRow, full && { opacity: 0.65 }]}>
      {/* Vertical timeline rail + dot */}
      <View style={s.railCol}>
        <View style={s.railLine} />
        <View style={[s.railDot, { borderColor: dotColor }]}>
          <View style={[s.railDotInner, { backgroundColor: dotColor }]} />
        </View>
      </View>

      {/* Content */}
      <View style={s.infoCol}>
        <View style={s.classTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.timeMain}>
              {fmtTime(item.startTime)}
              <Text style={s.timeDur}>  {dur}min</Text>
            </Text>
            <Text style={s.className} numberOfLines={1}>{item.name}</Text>
            <Text style={s.metaText} numberOfLines={1}>
              {[item.instructorName, item.clubName].filter(Boolean).join('  ·  ')}
            </Text>
          </View>

          {/* Book button */}
          {!bookable ? (
            <View style={s.bookBtnLocked}>
              <Ionicons name="lock-closed" size={13} color={colors.textMuted} />
              <Text style={s.lockedText}>{opensIn}</Text>
            </View>
          ) : full ? (
            <View style={s.bookBtnFull}>
              <Text style={s.fullText}>Full</Text>
            </View>
          ) : locked ? (
            <View style={[s.bookBtn, s.bookBtnBooked]}>
              <Ionicons name="checkmark" size={16} color="#fff" />
            </View>
          ) : (
            <Pressable
              style={[s.bookBtn, s.bookBtnAvail, isBooking && s.bookBtnLoading]}
              onPress={() => onBook(item.id, false)}
              disabled={isBooking}
              hitSlop={8}
            >
              {isBooking
                ? <ActivityIndicator color="#fff" size="small" />
                : <Ionicons name="add" size={20} color="#fff" />}
            </Pressable>
          )}
        </View>

        {/* Capacity pips */}
        <CapacityPips filled={item.participantsCount} total={item.maxParticipants} />
      </View>
    </View>
  );
}

/* ── Confirmation modal ── */
function ConfirmModal({ result, onClose }: { result: ConfirmResult | null; onClose: () => void }) {
  if (!result) return null;
  const isWaitlist = result.status === 'waitlist';
  return (
    <Modal transparent animationType="slide" visible={!!result}>
      <View style={s.modalBg}>
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />

          {/* Icon */}
          <View style={[cm.iconCircle, { backgroundColor: isWaitlist ? '#8B5CF615' : colors.success + '15' }]}>
            <Ionicons
              name={isWaitlist ? 'time' : 'checkmark-circle'}
              size={40}
              color={isWaitlist ? '#8B5CF6' : colors.success}
            />
          </View>

          <Text style={s.modalTitle}>
            {isWaitlist ? 'Added to Waitlist' : 'Booking Confirmed!'}
          </Text>

          {/* Booking details card */}
          <View style={cm.card}>
            <View style={cm.cardRow}>
              <Ionicons name="barbell-outline" size={16} color={colors.primary} />
              <Text style={cm.cardText} numberOfLines={1}>{result.className}</Text>
            </View>
            <View style={cm.divider} />
            <View style={cm.cardRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text style={cm.cardText}>{fmtDate(result.startTime)}</Text>
            </View>
            <View style={cm.divider} />
            <View style={cm.cardRow}>
              <Ionicons name="time-outline" size={16} color={colors.primary} />
              <Text style={cm.cardText}>{fmtTime(result.startTime)} – {fmtTime(result.endTime)}</Text>
            </View>
            {result.clubName && (<>
              <View style={cm.divider} />
              <View style={cm.cardRow}>
                <Ionicons name="location-outline" size={16} color={colors.primary} />
                <Text style={cm.cardText} numberOfLines={1}>{result.clubName}</Text>
              </View>
            </>)}
            {result.instructorName && (<>
              <View style={cm.divider} />
              <View style={cm.cardRow}>
                <Ionicons name="person-outline" size={16} color={colors.primary} />
                <Text style={cm.cardText}>{result.instructorName}</Text>
              </View>
            </>)}
          </View>

          <Pressable style={s.modalBtn} onPress={onClose}>
            <Text style={s.modalBtnText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
const cm = StyleSheet.create({
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  card: {
    width: '100%', borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bg, marginTop: 8, marginBottom: 4, overflow: 'hidden',
  },
  cardRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  cardText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text, flex: 1 },
  divider:  { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 16 },
});

/* ── Main screen ── */
export default function ClassesScreen() {
  const days = buildDays(DISPLAY_DAYS);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [savedToast, setSavedToast] = useState(false);

  // Load saved default filter on mount
  useEffect(() => {
    AsyncStorage.getItem(FILTERS_STORAGE_KEY).then(raw => {
      if (!raw) return;
      try { setFilters(JSON.parse(raw)); } catch { /* ignore corrupt data */ }
    });
  }, []);
  const [showFilter, setShowFilter] = useState(false);
  const [weekClasses, setWeekClasses] = useState<Record<string, GymClass[]>>({});
  const [dayBookings, setDayBookings] = useState<Map<string, DayBooking>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [toast, setToast] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [cancellingBanner, setCancellingBanner] = useState(false);
  const liveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBookedDays = useCallback(async () => {
    try {
      const { data } = await apiClient.get<any[]>('/bookings');
      const map = new Map<string, DayBooking>();
      for (const b of data) {
        if (!['confirmed', 'pending', 'waitlist', 'pending_verify'].includes(b.status)) continue;
        const st = b.startTime ?? b.createdAt;
        if (!st || !b.classId) continue;
        const key = new Date(st).toISOString().slice(0, 10);
        const existing = map.get(key);
        // Prefer confirmed/pending over waitlist if two entries on same day
        if (!existing || existing.status === 'waitlist') {
          map.set(key, {
            bookingId:    b.id,
            classId:      b.classId,
            status:       b.status,
            className:    b.className ?? `Class #${b.classId}`,
            clubName:     b.clubName ?? null,
            startTime:    b.startTime,
            endTime:      b.endTime,
            instructorName: b.instructorName ?? null,
          });
        }
      }
      setDayBookings(map);
    } catch { /* ignore */ }
  }, []);

  const fetchWeek = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [classesRes] = await Promise.all([
        apiClient.get<Record<string, GymClass[]>>('/booking/classes/week'),
        fetchBookedDays(),
      ]);
      setWeekClasses(classesRes.data);
      setLastUpdated(new Date());
    } catch { if (!silent) setError('Unable to load classes'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [fetchBookedDays]);

  useEffect(() => { fetchWeek(); }, [fetchWeek]);

  function selectDay(idx: number) { setSelectedIdx(idx); }

  const currentDayKey = dateKey(days[selectedIdx]);
  const now = Date.now();
  const allDayClasses = weekClasses[currentDayKey] ?? [];
  // Hide classes that have already started (past classes)
  const classes = allDayClasses.filter(c => new Date(c.startTime).getTime() > now);

  // Dynamic live refresh
  const hasRushClasses = classes.some(c => RUSH_CLASS_KEYWORDS.some(k => c.name.toLowerCase().includes(k)));
  const isPeak = PEAK_HOURS.some(([from, to]) => { const h = new Date().getHours(); return h >= from && h < to; });
  const refreshMs = hasRushClasses ? LIVE_REFRESH_FAST_MS
    : (classes.length > 0 && isPeak) ? LIVE_REFRESH_NORMAL_MS
    : LIVE_REFRESH_SLOW_MS;

  useEffect(() => {
    liveRef.current = setInterval(() => fetchWeek(true), refreshMs);
    return () => { if (liveRef.current) clearInterval(liveRef.current); };
  }, [fetchWeek, refreshMs]);

  async function doBook(classId: number, acceptWaitlist: boolean) {
    setBookingId(classId); setToast('');
    const classInfo = classes.find(c => c.id === classId);
    try {
      const { data } = await apiClient.post<{ success: boolean; bookingId: string; status: string }>(
        '/bookings', { classId, acceptWaitlist },
        { headers: { 'idempotency-key': generateUUID() } },
      );
      setConfirmResult({
        bookingId:      data.bookingId,
        status:         data.status,
        className:      classInfo?.name ?? `Class #${classId}`,
        startTime:      classInfo?.startTime ?? '',
        endTime:        classInfo?.endTime ?? '',
        clubName:       classInfo?.clubName ?? null,
        instructorName: classInfo?.instructorName ?? null,
      });
      await Promise.all([fetchBookedDays(), fetchWeek(true)]);
    } catch (err: any) {
      setToast(err?.response?.data?.message ?? 'Booking failed. Please try again.');
      setTimeout(() => setToast(''), 4000);
    } finally { setBookingId(null); }
  }

  function handleBook(classId: number, isWaitlist: boolean) { doBook(classId, isWaitlist); }

  async function handleSaveDefault(f: Filters) {
    await AsyncStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(f));
    setFilters(f);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  }

  async function handleBannerCancel(bookingId: string) {
    // Optimistic — remove banner immediately
    const prev = new Map(dayBookings);
    setDayBookings(map => { const next = new Map(map); next.delete(currentDayKey); return next; });
    setCancellingBanner(true);
    try {
      await apiClient.delete(`/bookings/${bookingId}`, { headers: { 'idempotency-key': generateUUID() } });
      await Promise.all([fetchBookedDays(), fetchWeek(true)]);
    } catch {
      setDayBookings(prev); // rollback on failure
      setToast('Failed to cancel. Please try again.');
      setTimeout(() => setToast(''), 4000);
    } finally { setCancellingBanner(false); }
  }

  const filtered = applyFilters(classes, search, filters);
  const filterCount = activeFilterCount(filters);
  const selectedDay = days[selectedIdx];
  const dateLabel = (selectedIdx === 0 ? 'Today ' : selectedIdx === 1 ? 'Tomorrow ' : '') +
    selectedDay.toLocaleDateString('en-HK', { day: 'numeric', month: 'long', year: 'numeric' });
  const liveLabel = lastUpdated
    ? `Live · ${lastUpdated.toLocaleTimeString('en-HK', { hour: '2-digit', minute: '2-digit', hour12: false })}`
    : 'Loading...';
  const todayBooking = dayBookings.get(currentDayKey) ?? null;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle={statusBarStyle} />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Classes</Text>
          <Text style={s.subtitle}>{dateLabel}</Text>
        </View>
        <Pressable style={[s.filterBtn, filterCount > 0 && s.filterBtnActive]} onPress={() => setShowFilter(true)} hitSlop={8}>
          <Ionicons name="options-outline" size={16} color={filterCount > 0 ? '#fff' : colors.text} />
          {filterCount > 0 && (
            <View style={s.filterBadge}><Text style={s.filterBadgeText}>{filterCount}</Text></View>
          )}
        </Pressable>
      </View>

      {/* Search — pill shape */}
      <View style={s.searchWrap}>
        <Ionicons name="search" size={14} color={colors.textMuted} />
        <TextInput style={s.searchInput} placeholder="Search classes..." placeholderTextColor={colors.textMuted}
          value={search} onChangeText={setSearch} returnKeyType="search" />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={15} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Club chips horizontal scroll */}
      {(() => {
        const allClubsList = Object.values(weekClasses)
          .flat()
          .reduce((acc, c) => {
            if (!c.clubId || !c.clubName) return acc;
            if (!acc.has(c.clubId)) acc.set(c.clubId, { id: c.clubId, name: c.clubName, count: 0 });
            acc.get(c.clubId)!.count++;
            return acc;
          }, new Map<number, { id: number; name: string; count: number }>());
        const clubList = Array.from(allClubsList.values()).sort((a, b) => b.count - a.count);
        const totalCount = clubList.reduce((s, c) => s + c.count, 0);
        return (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.clubChipsRow}>
            <Pressable
              style={[s.clubChip, filters.clubIds.length === 0 && s.clubChipActive]}
              onPress={() => setFilters(f => ({ ...f, clubIds: [] }))}
            >
              <Text style={[s.clubChipLabel, filters.clubIds.length === 0 && s.clubChipLabelActive]}>All clubs</Text>
              <Text style={[s.clubChipCount, filters.clubIds.length === 0 && s.clubChipCountActive]}>{totalCount}</Text>
            </Pressable>
            {clubList.map(club => {
              const active = filters.clubIds.includes(club.id) && filters.clubIds.length === 1;
              const short = club.name.replace(/go24\s+fitness\s*/i, '').replace(/onyx\s+by\s+go24\s*/i, 'ONYX ').trim();
              return (
                <Pressable
                  key={club.id}
                  style={[s.clubChip, active && s.clubChipActive]}
                  onPress={() => setFilters(f => ({ ...f, clubIds: active ? [] : [club.id] }))}
                >
                  <Text style={[s.clubChipLabel, active && s.clubChipLabelActive]}>{short}</Text>
                  <Text style={[s.clubChipCount, active && s.clubChipCountActive]}>{club.count}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        );
      })()}

      {/* Day picker with booking dots */}
      <View style={s.dayPickerWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayPicker}>
          {days.map((d, i) => {
            const key = dateKey(d);
            const hasBooking = dayBookings.has(key);
            const bookingStatus = dayBookings.get(key)?.status;
            const dotColor = bookingStatus === 'waitlist' ? '#8B5CF6' : colors.success;
            return (
              <Pressable key={i} style={[s.dayCell, i === selectedIdx && s.dayCellActive]} onPress={() => selectDay(i)}>
                <Text style={[s.dayLabel, i === selectedIdx && s.dayLabelActive]}>{DAYS[d.getDay()]}</Text>
                <Text style={[s.dayNum, i === selectedIdx && s.dayNumActive]}>{d.getDate()}</Text>
                {hasBooking ? (
                  <View style={[s.dayDot, { backgroundColor: i === selectedIdx ? 'rgba(255,255,255,0.25)' : colors.success + '20' }]}>
                    <Ionicons name="checkmark" size={9} color={i === selectedIdx ? '#fff' : dotColor} />
                  </View>
                ) : <View style={s.dayDotEmpty} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {toast ? <View style={s.toast}><Text style={s.toastText}>{toast}</Text></View> : null}
      {error ? <View style={s.toast}><Text style={s.toastText}>{error}</Text></View> : null}
      {savedToast ? (
        <View style={[s.toast, s.toastSuccess]}>
          <Ionicons name="bookmark" size={13} color={colors.success} />
          <Text style={[s.toastText, { color: colors.success }]}>Default filter saved</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        (() => {
          const SLOTS: { key: 'morning' | 'afternoon' | 'evening' | 'night'; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
            { key: 'morning',   label: 'MORNING',   icon: 'sunny-outline' },
            { key: 'afternoon', label: 'AFTERNOON', icon: 'partly-sunny-outline' },
            { key: 'evening',   label: 'EVENING',   icon: 'moon-outline' },
            { key: 'night',     label: 'NIGHT',     icon: 'moon' },
          ];
          const grouped = SLOTS.map(slot => {
            const items = filtered.filter(c => {
              const h = getHour(c.startTime);
              if (slot.key === 'morning')   return h < 12;
              if (slot.key === 'afternoon') return h >= 12 && h < 17;
              if (slot.key === 'evening')   return h >= 17 && h < 21;
              return h >= 21;
            });
            return { title: slot.label, icon: slot.icon, data: items };
          }).filter(s => s.data.length > 0);

          return (
            <SectionList
              sections={grouped}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <ClassRow
                  item={item}
                  onBook={handleBook}
                  isBooking={bookingId === item.id}
                  locked={dayBookings.has(currentDayKey)}
                />
              )}
              renderSectionHeader={({ section }) => (
                <View style={s.slotHeader}>
                  <Ionicons name={section.icon} size={13} color={colors.textMuted} />
                  <Text style={s.slotLabel}>{section.title}</Text>
                  <Text style={s.slotCount}>{section.data.length}</Text>
                  <View style={s.slotLine} />
                </View>
              )}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchWeek(false); }} tintColor={colors.primary} />}
              ListHeaderComponent={
                <>
                  <View style={s.dateHeader}>
                    <Text style={s.dateHeaderText}>{filtered.length} CLASSES</Text>
                    <Text style={s.liveLabel}>Live · refresh 30s</Text>
                  </View>
                  {todayBooking && (
                    <DayBookingBanner
                      booking={todayBooking}
                      onCancel={handleBannerCancel}
                      cancelling={cancellingBanner}
                    />
                  )}
                </>
              }
              ItemSeparatorComponent={() => <View style={s.separator} />}
              SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
              ListEmptyComponent={
                <View style={s.empty}>
                  <Ionicons name="calendar-outline" size={40} color={colors.border} />
                  <Text style={s.emptyTitle}>No classes found</Text>
                  <Text style={s.emptySub}>{filterCount > 0 ? 'Try adjusting your filters' : 'Check back later'}</Text>
                  {filterCount > 0 && (
                    <Pressable style={s.clearFiltersBtn} onPress={() => setFilters(DEFAULT_FILTERS)}>
                      <Text style={s.clearFiltersText}>Clear filters</Text>
                    </Pressable>
                  )}
                </View>
              }
              contentContainerStyle={{ backgroundColor: colors.card, paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            />
          );
        })()
      )}

      <FilterSheet visible={showFilter} filters={filters} allClasses={classes} onApply={setFilters} onClose={() => setShowFilter(false)} onSaveDefault={handleSaveDefault} />
      <ConfirmModal result={confirmResult} onClose={() => setConfirmResult(null)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.card },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10, backgroundColor: colors.card,
  },
  title:    { fontSize: 26, fontFamily: fonts.black, color: colors.text },
  subtitle: { fontSize: 12, fontFamily: fonts.bold, color: colors.textMuted, marginTop: 3 },
  filterBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
  },
  filterBtnActive:  { backgroundColor: colors.primary, borderColor: colors.primary },
  filterBadge:      { position: 'absolute', top: -3, right: -3, backgroundColor: colors.primary, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.card },
  filterBadgeText:  { fontSize: 8, fontFamily: fonts.black, color: '#fff' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 6,
    backgroundColor: colors.bg, borderRadius: 999,
    paddingHorizontal: 14, height: 40,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: fonts.semibold, color: colors.text, padding: 0 },

  // Club chips
  clubChipsRow:        { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, gap: 8, alignItems: 'center' },
  clubChip:            { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.bg },
  clubChipActive:      { backgroundColor: colors.text },
  clubChipLabel:       { fontSize: 12, fontFamily: fonts.black, color: colors.text },
  clubChipLabelActive: { color: colors.card },
  clubChipCount:       { fontSize: 10, fontFamily: fonts.bold, color: colors.textMuted },
  clubChipCountActive: { color: 'rgba(255,255,255,0.7)' },

  // Slot section header
  slotHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.card },
  slotLabel:   { fontSize: 10, fontFamily: fonts.black, color: colors.textMuted, letterSpacing: 1.5 },
  slotCount:   { fontSize: 10, fontFamily: fonts.black, color: colors.textMuted },
  slotLine:    { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 4 },

  dayPickerWrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  dayPicker:     { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 10, gap: 4, alignItems: 'center' },
  dayCell: {
    width: 42, height: 60, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  dayCellActive:  { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  dayLabel:       { fontSize: 9, fontFamily: fonts.black, color: colors.textMuted, letterSpacing: 1 },
  dayLabelActive: { color: 'rgba(255,255,255,0.8)' },
  dayNum:         { fontSize: 15, fontFamily: fonts.black, color: colors.text },
  dayNumActive:   { color: '#fff' },
  dayDot:         { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  dayDotEmpty:    { width: 5, height: 5 },

  dateHeader:     { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.bg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateHeaderText: { fontSize: 11, fontFamily: fonts.black, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  liveLabel:      { fontSize: 10, fontFamily: fonts.bold, color: colors.success },

  // Timeline row
  classRow:     { flexDirection: 'row', gap: 0, paddingRight: 16, paddingVertical: 16, backgroundColor: colors.card },
  separator:    { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 54 },

  railCol:      { width: 54, alignItems: 'center', position: 'relative' },
  railLine:     { position: 'absolute', top: 0, bottom: 0, left: 26, width: 1, backgroundColor: colors.border },
  railDot:      { width: 28, height: 28, borderRadius: 14, borderWidth: 2, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  railDotInner: { width: 8, height: 8, borderRadius: 4 },

  classTopRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  timeMain:     { fontSize: 11, fontFamily: fonts.black, color: colors.primary, letterSpacing: 0.3 },
  timeDur:      { fontSize: 11, fontFamily: fonts.regular, color: colors.textMuted },
  infoCol:      { flex: 1, gap: 2 },
  className:    { fontSize: 15, fontFamily: fonts.black, color: colors.text, marginTop: 2 },
  metaText:     { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted },

  bookBtn:        { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bookBtnAvail:   { backgroundColor: colors.text },
  bookBtnBooked:  { backgroundColor: colors.primary },
  bookBtnFull:    { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  fullText:       { fontSize: 10, fontFamily: fonts.black, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  bookBtnLoading: { opacity: 0.6 },
  bookBtnLocked:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, flexShrink: 0 },
  lockedText:     { fontSize: 8, fontFamily: fonts.black, color: colors.textMuted },

  toast:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginBottom: 4, backgroundColor: '#FFF0F0', borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: colors.primary },
  toastSuccess: { backgroundColor: colors.success + '15', borderLeftColor: colors.success },
  toastText:    { fontSize: 13, fontFamily: fonts.semibold, color: colors.primary },

  empty:           { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle:      { fontSize: 16, fontFamily: fonts.bold,    color: colors.textMuted },
  emptySub:        { fontSize: 13, fontFamily: fonts.regular, color: colors.textMuted },
  clearFiltersBtn: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.primary },
  clearFiltersText:{ fontSize: 13, fontFamily: fonts.semibold, color: colors.primary },

  modalBg:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:  { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, alignItems: 'center', gap: 10, paddingBottom: 36 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 4 },
  modalTitle:  { fontSize: 20, fontFamily: fonts.black, color: colors.text },
  modalBtn:    { backgroundColor: colors.cta, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 48, marginTop: 8, width: '100%', alignItems: 'center' },
  modalBtnText:{ color: '#fff', fontFamily: fonts.bold, fontSize: 16 },
});
