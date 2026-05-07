import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, FlatList, Modal, Pressable,
  RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../src/api/client';
import { colors } from '../../src/theme/colors';

interface GymClass {
  id: number; name: string; startTime: string; endTime: string;
  clubId: number; clubName: string | null; instructorName: string | null;
  maxParticipants: number; participantsCount: number;
  isWaitlist: boolean; isCancelled: boolean;
}
interface BookResult { success: boolean; bookingId: string; status: string; waitlistPosition?: number; }

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function fmt(iso: string, type: 'time' | 'date') {
  try {
    return type === 'time'
      ? new Date(iso).toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit', hour12: false })
      : new Date(iso).toLocaleDateString('zh-HK', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

function ClassCard({ item, onBook, isBooking }: { item: GymClass; onBook: (id: number, waitlist: boolean) => void; isBooking: boolean }) {
  const full = item.participantsCount >= item.maxParticipants;
  const pct = item.maxParticipants > 0 ? Math.min(item.participantsCount / item.maxParticipants, 1) : 0;
  const spotsLeft = item.maxParticipants - item.participantsCount;

  return (
    <View style={s.card}>
      {/* Time badge */}
      <View style={s.timeBadge}>
        <Text style={s.timeText}>{fmt(item.startTime, 'time')}</Text>
        <Text style={s.timeDash}>—</Text>
        <Text style={s.timeEnd}>{fmt(item.endTime, 'time')}</Text>
      </View>

      {/* Class info */}
      <View style={s.cardBody}>
        <Text style={s.className}>{item.name}</Text>
        <Text style={s.classDate}>{fmt(item.startTime, 'date')}</Text>
        {item.instructorName && <Text style={s.instructor}>👤 {item.instructorName}</Text>}

        {/* Capacity */}
        <View style={s.capacityRow}>
          <View style={s.progressBg}>
            <View style={[s.progressFill, { width: `${pct * 100}%` as any, backgroundColor: full ? colors.primary : colors.cta }]} />
          </View>
          <Text style={[s.spots, full && { color: colors.primary }]}>
            {full ? '已滿' : `剩 ${spotsLeft} 位`}
          </Text>
        </View>

        {/* Book button */}
        <Pressable
          style={[s.bookBtn, full && s.bookBtnWaitlist, isBooking && s.bookBtnDisabled]}
          onPress={() => onBook(item.id, full)}
          disabled={isBooking}
        >
          {isBooking
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.bookBtnText}>{full ? '加入候補' : '立即 Book'}</Text>
          }
        </Pressable>
      </View>
    </View>
  );
}

function SuccessModal({ result, onClose }: { result: BookResult | null; onClose: () => void }) {
  if (!result) return null;
  const isWaitlist = result.status === 'waitlist';
  return (
    <Modal transparent animationType="slide" visible={!!result}>
      <View style={s.modalBg}>
        <View style={s.modalCard}>
          <Text style={s.modalIcon}>{isWaitlist ? '⏳' : '✅'}</Text>
          <Text style={s.modalTitle}>{isWaitlist ? '已加入候補！' : '預約成功！'}</Text>
          <Text style={s.modalSub}>
            {isWaitlist ? '有位空出時會通知你' : '我哋已為你保留位置'}
          </Text>
          <View style={s.modalActions}>
            <Pressable style={s.modalBtn} onPress={onClose}>
              <Text style={s.modalBtnText}>確認</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function ClassesScreen() {
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [result, setResult] = useState<BookResult | null>(null);
  const [errorToast, setErrorToast] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await apiClient.get<GymClass[]>('/booking/classes', { params: { date: today } });
      setClasses(data);
    } catch { setError('無法載入堂表'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleBook(classId: number, acceptWaitlist: boolean) {
    setBookingId(classId); setErrorToast('');
    try {
      const { data } = await apiClient.post<BookResult>('/bookings', { classId, acceptWaitlist }, { headers: { 'idempotency-key': generateUUID() } });
      setResult(data); load();
    } catch (err: any) {
      setErrorToast(err?.response?.data?.message ?? '預約失敗，請再試');
      setTimeout(() => setErrorToast(''), 4000);
    } finally { setBookingId(null); }
  }

  if (loading) return (
    <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View></SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerSub}>TODAY</Text>
          <Text style={s.title}>堂表</Text>
        </View>
        <Text style={s.dateText}>{new Date().toLocaleDateString('zh-HK', { month: 'long', day: 'numeric', weekday: 'long' })}</Text>
      </View>

      {errorToast ? <View style={s.toast}><Text style={s.toastText}>{errorToast}</Text></View> : null}
      {error ? <View style={s.errorBar}><Text style={s.errorText}>{error}</Text></View> : null}

      <FlatList
        data={classes}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <ClassCard item={item} onBook={handleBook} isBooking={bookingId === item.id} />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={<Text style={s.empty}>今日未有堂</Text>}
        showsVerticalScrollIndicator={false}
      />
      <SuccessModal result={result} onClose={() => setResult(null)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:    { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  headerSub: { fontSize: 11, color: colors.primary, fontWeight: '700', letterSpacing: 2 },
  title:     { fontSize: 32, fontWeight: '900', color: colors.text },
  dateText:  { fontSize: 12, color: colors.textMuted, textAlign: 'right', lineHeight: 18 },

  card: {
    backgroundColor: colors.card, borderRadius: 18,
    flexDirection: 'row', overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
  },
  timeBadge: {
    width: 68, backgroundColor: colors.primary + '15',
    alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 1, borderRightColor: colors.primary + '30',
    paddingVertical: 18, gap: 2,
  },
  timeText:   { fontSize: 14, fontWeight: '900', color: colors.primary },
  timeDash:   { fontSize: 10, color: colors.primary + '60' },
  timeEnd:    { fontSize: 11, fontWeight: '600', color: colors.primary + '90' },

  cardBody:   { flex: 1, padding: 14, gap: 6 },
  className:  { fontSize: 17, fontWeight: '800', color: colors.text },
  classDate:  { fontSize: 12, color: colors.textMuted },
  instructor: { fontSize: 12, color: colors.textMuted },

  capacityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  progressBg:  { flex: 1, height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  spots:       { fontSize: 11, color: colors.textMuted, width: 50, textAlign: 'right', fontWeight: '600' },

  bookBtn: {
    backgroundColor: colors.cta, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', marginTop: 4,
  },
  bookBtnWaitlist:  { backgroundColor: colors.border },
  bookBtnDisabled:  { opacity: 0.6 },
  bookBtnText:      { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },

  toast:    { margin: 16, backgroundColor: colors.primary + '22', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.primary + '44' },
  toastText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  errorBar: { margin: 16, backgroundColor: colors.primary + '18', borderRadius: 10, padding: 12, alignItems: 'center' },
  errorText: { color: colors.primary, fontSize: 13 },
  empty:    { textAlign: 'center', color: colors.textMuted, marginTop: 60, fontSize: 15 },

  modalBg:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 32, width: '100%', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: colors.border },
  modalIcon:  { fontSize: 52 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: colors.text },
  modalSub:   { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  modalActions: { width: '100%', marginTop: 8 },
  modalBtn:  { backgroundColor: colors.cta, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
