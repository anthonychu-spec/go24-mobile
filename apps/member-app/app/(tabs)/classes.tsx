import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, FlatList, Pressable,
  RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/context';
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

function ClassCard({ item, onBook }: { item: GymClass; onBook: (id: number) => void }) {
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
        style={[s.bookBtn, full && s.bookBtnWaitlist]}
        onPress={() => onBook(item.id)}
      >
        <Text style={s.bookBtnText}>{full ? 'Join Waitlist' : 'Book'}</Text>
      </Pressable>
    </View>
  );
}

export default function ClassesScreen() {
  const { } = useAuth();
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState<number | null>(null);
  const [toast, setToast] = useState('');

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

  async function handleBook(classId: number) {
    setBooking(classId);
    try {
      const { data } = await apiClient.post<{ bookingId: number; isStandby: boolean }>(
        `/booking/classes/${classId}/book`, {}
      );
      setToast(data.isStandby ? 'Added to waitlist!' : 'Booked!');
      setTimeout(() => setToast(''), 3000);
      load();
    } catch (err: any) {
      setToast(err?.response?.data?.message ?? 'Booking failed');
      setTimeout(() => setToast(''), 3000);
    } finally {
      setBooking(null);
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
        <Text style={s.subtitle}>{new Date().toLocaleDateString('en-HK', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
      </View>

      {toast ? <View style={s.toast}><Text style={s.toastText}>{toast}</Text></View> : null}
      {error ? <View style={s.errorBar}><Text style={s.errorText}>{error}</Text></View> : null}

      <FlatList
        data={classes}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <ClassCard
            item={item}
            onBook={booking === item.id ? () => {} : handleBook}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={<Text style={s.empty}>No classes today</Text>}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  card: {
    backgroundColor: colors.card, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: colors.border, gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  className: { fontSize: 16, fontWeight: '700', color: colors.text },
  classDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  timeBadge: {
    backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: 10,
    paddingVertical: 6, alignItems: 'center',
  },
  timeText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  timeSep: { fontSize: 10, color: colors.textMuted },
  instructor: { fontSize: 13, color: colors.textMuted },
  spotsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barBg: { flex: 1, height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
  spotsText: { fontSize: 12, color: colors.textMuted, width: 60, textAlign: 'right' },
  bookBtn: {
    backgroundColor: colors.primary, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', marginTop: 4,
  },
  bookBtnWaitlist: { backgroundColor: colors.border },
  bookBtnText: { fontSize: 14, fontWeight: '700', color: colors.bg },
  toast: {
    margin: 16, backgroundColor: colors.success, borderRadius: 10,
    padding: 12, alignItems: 'center',
  },
  toastText: { color: colors.bg, fontWeight: '700' },
  errorBar: {
    margin: 16, backgroundColor: colors.error + '22', borderRadius: 10,
    padding: 12, alignItems: 'center',
  },
  errorText: { color: colors.error, fontSize: 13 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 60, fontSize: 15 },
});
