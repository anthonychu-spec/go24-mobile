import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, Pressable,
  RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../src/api/client';
import { colors } from '../../src/theme/colors';

interface GymClass {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  clubId: number;
  clubName: string | null;
  instructorName: string | null;
  maxParticipants: number;
  participantsCount: number;
  isWaitlist: boolean;
  isCancelled: boolean;
}

interface BookResult {
  success: boolean;
  bookingId: string;
  status: 'confirmed' | 'waitlist' | string;
  waitlistPosition?: number;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-HK', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return iso; }
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-HK', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

function SpotsBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.min(current / max, 1) : 0;
  const full = pct >= 1;
  return (
    <View style={s.spotsRow}>
      <View style={s.barBg}>
        <View style={[s.barFill, { width: `${pct * 100}%` as any, backgroundColor: full ? colors.error : colors.primary }]} />
      </View>
      <Text style={[s.spotsText, full && { color: colors.error }]}>
        {full ? 'Full' : `${max - current} spots`}
      </Text>
    </View>
  );
}

function SuccessModal({
  result,
  onClose,
}: {
  result: BookResult | null;
  onClose: () => void;
}) {
  if (!result) return null;
  const isWaitlist = result.status === 'waitlist';

  return (
    <Modal transparent animationType="fade" visible={!!result}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <Text style={s.modalIcon}>{isWaitlist ? '⏳' : '✅'}</Text>
          <Text style={s.modalTitle}>
            {isWaitlist ? 'Added to Waitlist' : 'Spot Reserved!'}
          </Text>
          {isWaitlist && result.waitlistPosition != null && (
            <Text style={s.modalSub}>You are #{result.waitlistPosition} on the waitlist</Text>
          )}
          {!isWaitlist && (
            <Text style={s.modalSub}>Your booking is confirmed.</Text>
          )}

          <Text style={s.modalTip}>
            {isWaitlist
              ? 'You will be notified via WhatsApp if a spot opens up.'
              : 'A reminder will be sent before the class starts.'}
          </Text>

          <View style={s.modalActions}>
            <Pressable style={s.modalBtnPrimary} onPress={onClose}>
              <Text style={s.modalBtnPrimaryText}>View My Bookings</Text>
            </Pressable>
            <Pressable style={s.modalBtnSecondary} onPress={onClose}>
              <Text style={s.modalBtnSecondaryText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ClassCard({
  item,
  onBook,
  isBooking,
}: {
  item: GymClass;
  onBook: (id: number, acceptWaitlist: boolean) => void;
  isBooking: boolean;
}) {
  const full = item.participantsCount >= item.maxParticipants;
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.className}>{item.name}</Text>
          <Text style={s.classDate}>{formatDate(item.startTime)}</Text>
        </View>
        <View style={s.timeBadge}>
          <Text style={s.timeText}>{formatTime(item.startTime)}</Text>
          <Text style={s.timeSep}>–</Text>
          <Text style={s.timeText}>{formatTime(item.endTime)}</Text>
        </View>
      </View>
      {item.instructorName && (
        <Text style={s.instructor}>👤 {item.instructorName}</Text>
      )}
      <SpotsBar current={item.participantsCount} max={item.maxParticipants} />
      <Pressable
        style={[s.bookBtn, full && s.bookBtnWaitlist, isBooking && s.bookBtnDisabled]}
        onPress={() => onBook(item.id, full)}
        disabled={isBooking}
      >
        {isBooking
          ? <ActivityIndicator color={colors.bg} size="small" />
          : <Text style={s.bookBtnText}>{full ? 'Join Waitlist' : 'Book'}</Text>
        }
      </Pressable>
    </View>
  );
}

export default function ClassesScreen() {
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [successResult, setSuccessResult] = useState<BookResult | null>(null);
  const [errorToast, setErrorToast] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get<GymClass[]>('/booking/classes', { params: { date: today } });
      setClasses(data);
    } catch {
      setError('Failed to load classes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [today]);

  useEffect(() => { load(); }, [load]);

  async function handleBook(classId: number, acceptWaitlist: boolean) {
    if (acceptWaitlist) {
      const confirmed = await new Promise<boolean>(resolve =>
        Alert.alert(
          '加入候補？',
          '有位空出時會用 WhatsApp 通知你，你有 5 分鐘確認。',
          [
            { text: '取消', style: 'cancel', onPress: () => resolve(false) },
            { text: '加入候補', onPress: () => resolve(true) },
          ],
        )
      );
      if (!confirmed) return;
    }

    setBookingId(classId);
    setErrorToast('');
    try {
      const { data } = await apiClient.post<BookResult>(
        '/bookings',
        { classId, acceptWaitlist },
        { headers: { 'idempotency-key': generateUUID() } },
      );
      setSuccessResult(data);
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Booking failed';
      setErrorToast(msg);
      setTimeout(() => setErrorToast(''), 4000);
    } finally {
      setBookingId(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Classes</Text>
        <Text style={s.subtitle}>
          {new Date().toLocaleDateString('en-HK', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
      </View>

      {errorToast ? (
        <View style={s.errorBar}><Text style={s.errorText}>{errorToast}</Text></View>
      ) : null}
      {error ? (
        <View style={s.errorBar}><Text style={s.errorText}>{error}</Text></View>
      ) : null}

      <FlatList
        data={classes}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <ClassCard
            item={item}
            onBook={handleBook}
            isBooking={bookingId === item.id}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={<Text style={s.empty}>No classes today</Text>}
      />

      <SuccessModal result={successResult} onClose={() => setSuccessResult(null)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.bg },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:      { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title:       { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle:    { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  card: {
    backgroundColor: colors.card, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: colors.border, gap: 8,
  },
  cardHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  className:   { fontSize: 16, fontWeight: '700', color: colors.text },
  classDate:   { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  timeBadge: {
    backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: 10,
    paddingVertical: 6, alignItems: 'center',
  },
  timeText:    { fontSize: 13, fontWeight: '700', color: colors.primary },
  timeSep:     { fontSize: 10, color: colors.textMuted },
  instructor:  { fontSize: 13, color: colors.textMuted },
  spotsRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barBg: { flex: 1, height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
  barFill:     { height: '100%', borderRadius: 2, backgroundColor: colors.cta },
  spotsText:   { fontSize: 12, color: colors.textMuted, width: 60, textAlign: 'right' },
  bookBtn: {
    backgroundColor: colors.cta, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', marginTop: 4, minHeight: 40,
  },
  bookBtnWaitlist:  { backgroundColor: colors.border },
  bookBtnDisabled:  { opacity: 0.6 },
  bookBtnText:      { fontSize: 14, fontWeight: '700', color: colors.bg },
  errorBar: {
    margin: 16, backgroundColor: colors.error + '22', borderRadius: 10,
    padding: 12, alignItems: 'center',
  },
  errorText:   { color: colors.error, fontSize: 13 },
  empty:       { textAlign: 'center', color: colors.textMuted, marginTop: 60, fontSize: 15 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: colors.card, borderRadius: 20, padding: 28,
    width: '100%', alignItems: 'center', gap: 8,
  },
  modalIcon:            { fontSize: 52 },
  modalTitle:           { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  modalSub:             { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  modalTip: {
    fontSize: 13, color: colors.textMuted, textAlign: 'center',
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: 12, marginTop: 4,
  },
  modalActions:         { width: '100%', gap: 8, marginTop: 8 },
  modalBtnPrimary: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  modalBtnPrimaryText:  { color: colors.bg, fontWeight: '700', fontSize: 15 },
  modalBtnSecondary: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  modalBtnSecondaryText: { color: colors.textMuted, fontSize: 14 },
});
