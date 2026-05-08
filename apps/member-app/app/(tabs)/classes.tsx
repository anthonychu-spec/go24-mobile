import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ActivityIndicator, FlatList, Modal, Pressable,
  RefreshControl, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../src/api/client';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';

interface GymClass {
  id: number; name: string; startTime: string; endTime: string;
  clubId: number; clubName: string | null; instructorName: string | null;
  maxParticipants: number; participantsCount: number;
  isWaitlist: boolean; isCancelled: boolean;
}
interface BookResult { success: boolean; bookingId: string; status: string; waitlistPosition?: number; }

type TimeSlot = 'all' | 'morning' | 'afternoon' | 'evening';

interface Filters {
  availableOnly: boolean;
  timeSlot: TimeSlot;
  classType: string | null;   // null = all class types
  clubId: number | null;      // null = all clubs
}

const DEFAULT_FILTERS: Filters = {
  availableOnly: false,
  timeSlot: 'all',
  classType: null,
  clubId: null,
};
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const LIVE_REFRESH_MS = 30_000; // refresh capacity every 30s
const BOOKING_WINDOW_H = 168;  // members can book up to 168 hours ahead

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

function applyFilters(classes: GymClass[], search: string, filters: Filters): GymClass[] {
  return classes.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filters.availableOnly && c.participantsCount >= c.maxParticipants) return false;
    if (filters.classType && c.name !== filters.classType) return false;
    if (filters.clubId !== null && c.clubId !== filters.clubId) return false;
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
  if (f.classType) n++;
  if (f.clubId !== null) n++;
  return n;
}

// Extract unique class types and clubs from loaded classes
function getClassOptions(classes: GymClass[]) {
  const typeSet = new Map<string, string>();       // name → name
  const clubSet = new Map<number, string>();       // id → name
  for (const c of classes) {
    if (c.name) typeSet.set(c.name, c.name);
    if (c.clubId && c.clubName) clubSet.set(c.clubId, c.clubName);
  }
  return {
    classTypes: Array.from(typeSet.values()).sort(),
    clubs: Array.from(clubSet.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/* ── Capacity bar ── */
function CapacityBar({ filled, total }: { filled: number; total: number }) {
  if (total <= 0) return null;
  const pct = Math.min(filled / total, 1);
  const spotsLeft = total - filled;
  const barColor = pct >= 1 ? colors.error : pct >= 0.8 ? colors.cta : colors.success;

  return (
    <View style={cb.wrap}>
      <View style={cb.track}>
        <View style={[cb.fill, { width: `${pct * 100}%` as any, backgroundColor: barColor }]} />
      </View>
      <Text style={[cb.label, { color: pct >= 1 ? colors.error : colors.textMuted }]}>
        {pct >= 1 ? 'Full' : `${spotsLeft} / ${total}`}
      </Text>
    </View>
  );
}

const cb = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  track: { flex: 1, height: 3, backgroundColor: colors.bg, borderRadius: 2, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 2 },
  label: { fontSize: 11, fontFamily: fonts.regular, minWidth: 44, textAlign: 'right' },
});

/* ── Filter sheet ── */
function FilterSheet({
  visible, filters, allClasses, onApply, onClose,
}: {
  visible: boolean;
  filters: Filters;
  allClasses: GymClass[];
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(filters);
  useEffect(() => { if (visible) setDraft(filters); }, [visible]);

  const { classTypes, clubs } = getClassOptions(allClasses);

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
        <View style={fs.header}>
          <Text style={fs.title}>Filter Classes</Text>
          <Pressable onPress={() => { setDraft(DEFAULT_FILTERS); onApply(DEFAULT_FILTERS); onClose(); }}>
            <Text style={fs.reset}>Reset all</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Available only */}
          <View style={fs.row}>
            <View style={fs.rowLeft}>
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
              <Text style={fs.rowLabel}>Available spots only</Text>
            </View>
            <Switch
              value={draft.availableOnly}
              onValueChange={v => setDraft(d => ({ ...d, availableOnly: v }))}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#fff"
            />
          </View>

          {/* Time of day */}
          <Text style={fs.sectionLabel}>Time of day</Text>
          <View style={fs.chips}>
            {TIME_SLOTS.map(ts => (
              <Pressable
                key={ts.key}
                style={[fs.chip, draft.timeSlot === ts.key && fs.chipActive]}
                onPress={() => setDraft(d => ({ ...d, timeSlot: ts.key }))}
              >
                <Ionicons name={ts.icon} size={15} color={draft.timeSlot === ts.key ? '#fff' : colors.textMuted} />
                <Text style={[fs.chipText, draft.timeSlot === ts.key && fs.chipTextActive]}>{ts.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Club filter */}
          {clubs.length > 0 && (
            <>
              <Text style={fs.sectionLabel}>Club</Text>
              <View style={fs.chips}>
                <Pressable
                  style={[fs.chip, draft.clubId === null && fs.chipActive]}
                  onPress={() => setDraft(d => ({ ...d, clubId: null }))}
                >
                  <Text style={[fs.chipText, draft.clubId === null && fs.chipTextActive]}>All clubs</Text>
                </Pressable>
                {clubs.map(club => (
                  <Pressable
                    key={club.id}
                    style={[fs.chip, draft.clubId === club.id && fs.chipActive]}
                    onPress={() => setDraft(d => ({ ...d, clubId: d.clubId === club.id ? null : club.id }))}
                  >
                    <Ionicons name="location-outline" size={13} color={draft.clubId === club.id ? '#fff' : colors.textMuted} />
                    <Text style={[fs.chipText, draft.clubId === club.id && fs.chipTextActive]} numberOfLines={1}>
                      {club.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {/* Class type filter */}
          {classTypes.length > 0 && (
            <>
              <Text style={fs.sectionLabel}>Class type</Text>
              <View style={fs.chips}>
                <Pressable
                  style={[fs.chip, draft.classType === null && fs.chipActive]}
                  onPress={() => setDraft(d => ({ ...d, classType: null }))}
                >
                  <Text style={[fs.chipText, draft.classType === null && fs.chipTextActive]}>All types</Text>
                </Pressable>
                {classTypes.map(ct => (
                  <Pressable
                    key={ct}
                    style={[fs.chip, draft.classType === ct && fs.chipActive]}
                    onPress={() => setDraft(d => ({ ...d, classType: d.classType === ct ? null : ct }))}
                  >
                    <Text style={[fs.chipText, draft.classType === ct && fs.chipTextActive]} numberOfLines={1}>
                      {ct}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </ScrollView>

        <Pressable style={fs.applyBtn} onPress={() => { onApply(draft); onClose(); }}>
          <Text style={fs.applyText}>
            Show Results
            {activeFilterCount(draft) > 0 ? ` · ${activeFilterCount(draft)} active` : ''}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const fs = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
    position: 'absolute', bottom: 0, left: 0, right: 0,
    maxHeight: '80%',
  },
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title:       { fontSize: 18, fontFamily: fonts.black, color: colors.text },
  reset:       { fontSize: 14, fontFamily: fonts.semibold, color: colors.primary },

  row:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowLeft:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabel:    { fontSize: 15, fontFamily: fonts.regular, color: colors.text },

  sectionLabel:{ fontSize: 12, fontFamily: fonts.bold, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginTop: 20, marginBottom: 12 },
  chips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText:       { fontSize: 14, fontFamily: fonts.regular, color: colors.textMuted },
  chipTextActive: { color: '#fff', fontFamily: fonts.semibold },

  applyBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 24,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  applyText: { color: '#fff', fontSize: 16, fontFamily: fonts.bold },
});

/* ── Class row ── */
function ClassRow({ item, onBook, isBooking, dayBooked }: {
  item: GymClass;
  onBook: (id: number, waitlist: boolean) => void;
  isBooking: boolean;
  dayBooked: boolean;
}) {
  const full = item.participantsCount >= item.maxParticipants;
  const dur = durationMin(item.startTime, item.endTime);
  const { bookable, opensIn } = bookingWindowStatus(item.startTime);

  return (
    <View style={s.classRow}>
      <View style={s.timeCol}>
        <Text style={s.timeMain}>{fmtTime(item.startTime)}</Text>
        <Text style={s.timeDur}>{dur}min</Text>
      </View>

      <View style={s.infoCol}>
        <Text style={s.className} numberOfLines={1}>{item.name}</Text>
        {item.instructorName && (
          <View style={s.metaRow}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {item.instructorName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <Text style={s.metaText}>{item.instructorName}</Text>
          </View>
        )}
        {item.clubName && (
          <View style={s.metaRow}>
            <Ionicons name="location" size={12} color={colors.primary} />
            <Text style={s.metaText}>{item.clubName}</Text>
          </View>
        )}
        <CapacityBar filled={item.participantsCount} total={item.maxParticipants} />
      </View>

      {!bookable ? (
        <View style={s.bookBtnLocked}>
          <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
          <Text style={s.lockedText}>{opensIn}</Text>
        </View>
      ) : dayBooked && !full ? (
        <View style={s.bookBtnLocked}>
          <Ionicons name="checkmark" size={14} color={colors.success} />
          <Text style={[s.lockedText, { color: colors.success }]}>1/1</Text>
        </View>
      ) : (
        <Pressable
          style={[s.bookBtn, full ? s.bookBtnFull : dayBooked ? s.bookBtnFull : s.bookBtnAvail, isBooking && s.bookBtnLoading]}
          onPress={() => onBook(item.id, full)}
          disabled={isBooking}
          hitSlop={8}
        >
          {isBooking
            ? <ActivityIndicator color={full ? colors.textMuted : '#fff'} size="small" />
            : <Ionicons name={full ? 'hourglass-outline' : 'add'} size={20} color={full ? colors.textMuted : '#fff'} />
          }
        </Pressable>
      )}
    </View>
  );
}

function SuccessModal({ result, onClose }: { result: BookResult | null; onClose: () => void }) {
  if (!result) return null;
  const isWaitlist = result.status === 'waitlist';
  return (
    <Modal transparent animationType="slide" visible={!!result}>
      <View style={s.modalBg}>
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <Ionicons
            name={isWaitlist ? 'time' : 'checkmark-circle'}
            size={56}
            color={isWaitlist ? colors.textMuted : colors.success}
          />
          <Text style={s.modalTitle}>{isWaitlist ? 'Added to Waitlist' : 'Booking Confirmed!'}</Text>
          <Text style={s.modalSub}>
            {isWaitlist ? "We'll notify you when a spot opens up" : 'Your spot has been reserved'}
          </Text>
          <Pressable style={s.modalBtn} onPress={onClose}>
            <Text style={s.modalBtnText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/* ── Main screen ── */
export default function ClassesScreen() {
  const days = buildDays(7);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilter, setShowFilter] = useState(false);
  // weekClasses: map of "YYYY-MM-DD" → GymClass[]
  const [weekClasses, setWeekClasses] = useState<Record<string, GymClass[]>>({});
  const [bookedDays, setBookedDays] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [result, setResult] = useState<BookResult | null>(null);
  const [toast, setToast] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const liveRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Initial load — fetches all 7 days at once
  useEffect(() => { fetchWeek(); }, [fetchWeek]);

  // Live refresh every 30s — silently updates capacity for all days
  useEffect(() => {
    liveRef.current = setInterval(() => fetchWeek(true), LIVE_REFRESH_MS);
    return () => { if (liveRef.current) clearInterval(liveRef.current); };
  }, [fetchWeek]);

  // Day switching is instant — no API call needed
  function selectDay(idx: number) { setSelectedIdx(idx); }

  // Get classes for the selected day
  const dayKey = (() => {
    const d = days[selectedIdx];
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const classes = weekClasses[dayKey] ?? [];

  async function handleBook(classId: number, acceptWaitlist: boolean) {
    setBookingId(classId); setToast('');
    try {
      const { data } = await apiClient.post<BookResult>('/bookings', { classId, acceptWaitlist }, {
        headers: { 'idempotency-key': generateUUID() },
      });
      setResult(data);
      fetchBookedDays(); // refresh daily limit state
      fetchWeek(true); // silent refresh after booking
    } catch (err: any) {
      setToast(err?.response?.data?.message ?? 'Booking failed. Please try again.');
      setTimeout(() => setToast(''), 4000);
    } finally { setBookingId(null); }
  }

  const filtered = applyFilters(classes, search, filters);
  const filterCount = activeFilterCount(filters);

  const selectedDay = days[selectedIdx];
  const dateLabel = (selectedIdx === 0 ? 'Today ' : selectedIdx === 1 ? 'Tomorrow ' : '') +
    selectedDay.toLocaleDateString('en-HK', { day: 'numeric', month: 'long', year: 'numeric' });

  const liveLabel = lastUpdated
    ? `Live · ${lastUpdated.toLocaleTimeString('en-HK', { hour: '2-digit', minute: '2-digit', hour12: false })}`
    : 'Loading...';

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.card} />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Book classes</Text>
        <Pressable
          style={[s.filterBtn, filterCount > 0 && s.filterBtnActive]}
          onPress={() => setShowFilter(true)}
          hitSlop={8}
        >
          <Ionicons name="options-outline" size={18} color={filterCount > 0 ? '#fff' : colors.text} />
          {filterCount > 0 && (
            <View style={s.filterBadge}>
              <Text style={s.filterBadgeText}>{filterCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={s.searchInput}
          placeholder="Search for classes"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Day picker */}
      <View style={s.dayPickerWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayPicker}>
          {days.map((d, i) => (
            <Pressable
              key={i}
              style={[s.dayCell, i === selectedIdx && s.dayCellActive]}
              onPress={() => selectDay(i)}
            >
              <Text style={[s.dayLabel, i === selectedIdx && s.dayLabelActive]}>{DAYS[d.getDay()]}</Text>
              <Text style={[s.dayNum,   i === selectedIdx && s.dayNumActive]}>{d.getDate()}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {toast ? <View style={s.toast}><Text style={s.toastText}>{toast}</Text></View> : null}
      {error ? <View style={s.toast}><Text style={s.toastText}>{error}</Text></View> : null}

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <ClassRow item={item} onBook={handleBook} isBooking={bookingId === item.id} dayBooked={bookedDays.has(dayKey)} />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchWeek(false); }} tintColor={colors.primary} />}
          ListHeaderComponent={
            <View style={s.dateHeader}>
              <Text style={s.dateHeaderText}>{dateLabel}</Text>
              <Text style={s.liveLabel}>
                <Ionicons name="radio-button-on" size={10} color={colors.success} />
                {' '}{liveLabel}
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={s.separator} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="calendar-outline" size={40} color={colors.border} />
              <Text style={s.emptyTitle}>No classes found</Text>
              <Text style={s.emptySub}>
                {filterCount > 0 ? 'Try adjusting your filters' : 'Check back later'}
              </Text>
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
      )}

      <FilterSheet
        visible={showFilter}
        filters={filters}
        allClasses={classes}
        onApply={setFilters}
        onClose={() => setShowFilter(false)}
      />
      <SuccessModal result={result} onClose={() => setResult(null)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.card },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
    backgroundColor: colors.card,
  },
  title:   { fontSize: 30, fontFamily: fonts.black, color: colors.text },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterBadge: {
    backgroundColor: '#fff', width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 9, fontFamily: fonts.black, color: colors.primary },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 4,
    backgroundColor: colors.bg, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: fonts.regular, color: colors.text, padding: 0 },

  dayPickerWrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  dayPicker:     { paddingHorizontal: 12, paddingBottom: 10, paddingTop: 6, gap: 2 },
  dayCell: {
    width: 46, height: 64, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', gap: 3,
  },
  dayCellActive:  { backgroundColor: colors.primary },
  dayLabel:       { fontSize: 11, fontFamily: fonts.bold, color: colors.textMuted, letterSpacing: 1 },
  dayLabelActive: { color: 'rgba(255,255,255,0.8)' },
  dayNum:         { fontSize: 22, fontFamily: fonts.black, color: '#C7C7CC' },
  dayNumActive:   { color: '#fff' },

  dateHeader:     { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.bg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateHeaderText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.text },
  liveLabel:      { fontSize: 11, fontFamily: fonts.regular, color: colors.success },

  classRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: colors.card,
  },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 16 },

  timeCol:  { width: 58 },
  timeMain: { fontSize: 16, fontFamily: fonts.black, color: colors.primary },
  timeDur:  { fontSize: 11, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 2 },

  infoCol:  { flex: 1, gap: 4 },
  className:{ fontSize: 16, fontFamily: fonts.bold, color: colors.text },

  metaRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted },

  avatar: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 8, fontFamily: fonts.bold, color: colors.textMuted },

  bookBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  bookBtnAvail:   { backgroundColor: colors.cta },
  bookBtnFull:    { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  bookBtnLoading: { opacity: 0.6 },
  bookBtnLocked: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
  },
  lockedText: { fontSize: 9, fontFamily: fonts.bold, color: colors.textMuted, marginTop: 1 },

  toast:    { marginHorizontal: 16, marginBottom: 4, backgroundColor: '#FFF0F0', borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: colors.primary },
  toastText:{ fontSize: 13, fontFamily: fonts.semibold, color: colors.primary },

  empty:          { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle:     { fontSize: 16, fontFamily: fonts.bold,    color: colors.textMuted },
  emptySub:       { fontSize: 13, fontFamily: fonts.regular, color: colors.textMuted },
  clearFiltersBtn:{ marginTop: 4, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.primary },
  clearFiltersText:{ fontSize: 13, fontFamily: fonts.semibold, color: colors.primary },

  modalBg:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, alignItems: 'center', gap: 8, paddingBottom: 36 },
  modalHandle:{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 8 },
  modalTitle: { fontSize: 20, fontFamily: fonts.black, color: colors.text },
  modalSub:   { fontSize: 14, fontFamily: fonts.regular, color: colors.textMuted, textAlign: 'center' },
  modalBtn:   { backgroundColor: colors.cta, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 48, marginTop: 10 },
  modalBtnText:{ color: '#fff', fontFamily: fonts.bold, fontSize: 16 },
});
