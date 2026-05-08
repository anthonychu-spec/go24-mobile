import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, FlatList, Modal, Pressable,
  RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, View,
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

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

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

function buildDays(count = 7) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i); return d;
  });
}

function InstructorAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={s.avatar}>
      <Text style={s.avatarText}>{initials}</Text>
    </View>
  );
}

function ClassRow({ item, onBook, isBooking }: { item: GymClass; onBook: (id: number, waitlist: boolean) => void; isBooking: boolean }) {
  const full = item.participantsCount >= item.maxParticipants;
  const spotsLeft = item.maxParticipants - item.participantsCount;
  const dur = durationMin(item.startTime, item.endTime);

  return (
    <View style={s.classRow}>
      {/* Time */}
      <View style={s.timeCol}>
        <Text style={s.timeMain}>{fmtTime(item.startTime)}</Text>
        <Text style={s.timeDur}>{dur}min</Text>
      </View>

      {/* Info */}
      <View style={s.infoCol}>
        <Text style={s.className} numberOfLines={1}>{item.name}</Text>
        {item.instructorName && (
          <View style={s.metaRow}>
            <InstructorAvatar name={item.instructorName} />
            <Text style={s.metaText}>{item.instructorName}</Text>
          </View>
        )}
        {item.clubName && (
          <View style={s.metaRow}>
            <Ionicons name="location" size={12} color={colors.primary} />
            <Text style={s.metaText}>{item.clubName}</Text>
          </View>
        )}
        {!full && spotsLeft <= 5 && (
          <View style={s.metaRow}>
            <Ionicons name="people-outline" size={12} color={colors.cta} />
            <Text style={[s.metaText, { color: colors.cta }]}>{spotsLeft} spots left</Text>
          </View>
        )}
      </View>

      {/* Book button */}
      <Pressable
        style={[s.bookBtn, full ? s.bookBtnFull : s.bookBtnAvail, isBooking && s.bookBtnLoading]}
        onPress={() => onBook(item.id, full)}
        disabled={isBooking}
        hitSlop={8}
      >
        {isBooking
          ? <ActivityIndicator color={full ? colors.textMuted : '#fff'} size="small" />
          : <Ionicons name="add" size={20} color={full ? colors.textMuted : '#fff'} />
        }
      </Pressable>
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
          <Ionicons name={isWaitlist ? 'time' : 'checkmark-circle'} size={52} color={isWaitlist ? colors.textMuted : colors.success} />
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

export default function ClassesScreen() {
  const days = buildDays(7);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [search, setSearch] = useState('');
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [result, setResult] = useState<BookResult | null>(null);
  const [toast, setToast] = useState('');

  const load = useCallback(async (isRefresh = false, idx = selectedIdx) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const d = days[idx];
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const { data } = await apiClient.get<GymClass[]>('/booking/classes', { params: { date } });
      setClasses(data);
    } catch { setError('Unable to load classes'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [selectedIdx]);

  useEffect(() => { load(); }, [load]);

  function selectDay(idx: number) { setSelectedIdx(idx); load(false, idx); }

  async function handleBook(classId: number, acceptWaitlist: boolean) {
    setBookingId(classId); setToast('');
    try {
      const { data } = await apiClient.post<BookResult>('/bookings', { classId, acceptWaitlist }, {
        headers: { 'idempotency-key': generateUUID() },
      });
      setResult(data); load();
    } catch (err: any) {
      setToast(err?.response?.data?.message ?? 'Booking failed. Please try again.');
      setTimeout(() => setToast(''), 4000);
    } finally { setBookingId(null); }
  }

  const filtered = search
    ? classes.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : classes;

  const selectedDay = days[selectedIdx];
  const dateLabel = (selectedIdx === 0 ? 'Today ' : selectedIdx === 1 ? 'Tomorrow ' : '') +
    selectedDay.toLocaleDateString('en-HK', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.card} />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Book classes</Text>
        <Pressable hitSlop={12}>
          <Ionicons name="options-outline" size={22} color={colors.text} />
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

      {/* Toast */}
      {toast ? (
        <View style={s.toast}><Text style={s.toastText}>{toast}</Text></View>
      ) : null}
      {error ? (
        <View style={s.toast}><Text style={s.toastText}>{error}</Text></View>
      ) : null}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <ClassRow item={item} onBook={handleBook} isBooking={bookingId === item.id} />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
          ListHeaderComponent={
            <View style={s.dateHeader}>
              <Text style={s.dateHeaderText}>{dateLabel}</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={s.separator} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="calendar-outline" size={40} color={colors.border} />
              <Text style={s.emptyText}>No classes available</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 20, backgroundColor: colors.card }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <SuccessModal result={result} onClose={() => setResult(null)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.card },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4,
    backgroundColor: colors.card,
  },
  title: { fontSize: 30, fontFamily: fonts.black, color: colors.text },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginVertical: 10,
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

  dateHeader:     { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.bg },
  dateHeaderText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.text },

  classRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: colors.card,
  },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 16 },

  timeCol:  { width: 58 },
  timeMain: { fontSize: 16, fontFamily: fonts.black, color: colors.primary },
  timeDur:  { fontSize: 11, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 2 },

  infoCol: { flex: 1, gap: 5 },
  className: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted },

  avatar: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 8, fontFamily: fonts.bold, color: colors.textMuted },

  bookBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  bookBtnAvail:   { backgroundColor: colors.cta },
  bookBtnFull:    { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  bookBtnLoading: { opacity: 0.6 },

  toast:    { marginHorizontal: 16, marginBottom: 4, backgroundColor: '#FFF0F0', borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: colors.primary },
  toastText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.primary },

  empty:     { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 15, fontFamily: fonts.regular, color: colors.textMuted },

  modalBg:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 28, alignItems: 'center', gap: 8, paddingBottom: 36,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 8 },
  modalTitle:  { fontSize: 20, fontFamily: fonts.black, color: colors.text },
  modalSub:    { fontSize: 14, fontFamily: fonts.regular, color: colors.textMuted, textAlign: 'center' },
  modalBtn:    { backgroundColor: colors.cta, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 48, marginTop: 10 },
  modalBtnText:{ color: '#fff', fontFamily: fonts.bold, fontSize: 16 },
});
