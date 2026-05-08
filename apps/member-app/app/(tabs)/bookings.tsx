import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Pressable,
  RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../src/api/client';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';

interface Booking {
  id: string; classId: number; status: string;
  waitlistPosition?: number; errorCode?: string; createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  confirmed:      { label: 'Confirmed',  color: colors.success, icon: 'checkmark-circle' },
  pending:        { label: 'Pending',    color: '#F59E0B',      icon: 'time' },
  waitlist:       { label: 'Waitlist',   color: '#8B5CF6',      icon: 'people' },
  pending_verify: { label: 'Verifying',  color: '#F59E0B',      icon: 'sync' },
  cancelled:      { label: 'Cancelled',  color: colors.textMuted, icon: 'close-circle' },
  failed:         { label: 'Failed',     color: colors.error,   icon: 'alert-circle' },
  attended:       { label: 'Attended',   color: colors.success, icon: 'checkmark-done-circle' },
  no_show:        { label: 'No-Show',    color: colors.error,   icon: 'close-circle' },
};

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function BookingRow({ item, onCancel, cancelling }: {
  item: Booking; onCancel: (id: string) => void; cancelling: boolean;
}) {
  const canCancel = ['confirmed', 'waitlist', 'pending'].includes(item.status);
  const cfg = STATUS_CONFIG[item.status] ?? { label: item.status, color: colors.textMuted, icon: 'ellipse-outline' as const };
  const date = new Date(item.createdAt).toLocaleDateString('en-HK', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
  const time = new Date(item.createdAt).toLocaleTimeString('en-HK', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <View style={s.row}>
      <View style={[s.statusDot, { backgroundColor: cfg.color + '20' }]}>
        <Ionicons name={cfg.icon} size={18} color={cfg.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>Class #{item.classId}</Text>
        <Text style={s.rowSub}>{date}  ·  {time}</Text>
        {item.waitlistPosition != null && (
          <Text style={s.rowWaitlist}>Waitlist position #{item.waitlistPosition}</Text>
        )}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <View style={[s.badge, { backgroundColor: cfg.color + '15' }]}>
          <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        {canCancel && (
          <Pressable onPress={() => onCancel(item.id)} disabled={cancelling} hitSlop={8}>
            <Text style={s.cancelText}>Cancel</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

type BookingTab = 'upcoming' | 'past';

const UPCOMING_STATUSES = ['confirmed', 'pending', 'waitlist', 'pending_verify'];
const PAST_STATUSES     = ['attended', 'no_show', 'cancelled', 'failed'];

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState<BookingTab>('upcoming');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get<Booking[]>('/bookings');
      setBookings(data);
    } catch { setError('Failed to load bookings'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCancel = useCallback((bookingId: string) => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Booking', style: 'destructive',
        onPress: async () => {
          setCancelling(bookingId);
          try {
            await apiClient.delete(`/bookings/${bookingId}`, { headers: { 'idempotency-key': generateUUID() } });
            load();
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.message ?? 'Failed to cancel');
          } finally { setCancelling(null); }
        },
      },
    ]);
  }, [load]);

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
    </SafeAreaView>
  );

  const displayed = bookings.filter(b =>
    activeTab === 'upcoming'
      ? UPCOMING_STATUSES.includes(b.status)
      : PAST_STATUSES.includes(b.status)
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>My Bookings</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['upcoming', 'past'] as BookingTab[]).map(t => (
          <Pressable
            key={t}
            style={[s.tabBtn, activeTab === t && s.tabBtnActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[s.tabText, activeTab === t && s.tabTextActive]}>
              {t === 'upcoming' ? 'Upcoming' : 'Past'}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <View style={s.errorBar}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={displayed}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <BookingRow item={item} onCancel={handleCancel} cancelling={cancelling === item.id} />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        ItemSeparatorComponent={() => <View style={s.separator} />}
        contentContainerStyle={{ backgroundColor: colors.card }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="bookmark-outline" size={40} color={colors.border} />
            <Text style={s.emptyTitle}>
              {activeTab === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'}
            </Text>
            <Text style={s.emptySub}>
              {activeTab === 'upcoming' ? 'Book a class from the Classes tab' : 'Your completed classes will appear here'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  title: { fontSize: 28, fontFamily: fonts.black, color: colors.text },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.card,
  },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 16 },

  statusDot: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  rowTitle:    { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  rowSub:      { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 2 },
  rowWaitlist: { fontSize: 12, fontFamily: fonts.semibold, color: '#8B5CF6', marginTop: 2 },

  badge:     { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontFamily: fonts.bold },
  cancelText:{ fontSize: 12, fontFamily: fonts.semibold, color: colors.error },

  tabRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  tabBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
    backgroundColor: colors.bg,
  },
  tabBtnActive:  { backgroundColor: colors.primary },
  tabText:       { fontSize: 14, fontFamily: fonts.semibold, color: colors.textMuted },
  tabTextActive: { color: '#fff' },

  errorBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 16, backgroundColor: '#FFF0F0', borderRadius: 8, padding: 12,
  },
  errorText: { fontSize: 13, fontFamily: fonts.regular, color: colors.error },

  empty:      { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: fonts.bold,    color: colors.textMuted },
  emptySub:   { fontSize: 13, fontFamily: fonts.regular, color: colors.textMuted },
});
