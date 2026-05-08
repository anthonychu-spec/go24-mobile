import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, FlatList, Pressable,
  RefreshControl, SectionList, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../src/api/client';
import { colors } from '../src/theme/colors';
import { fonts } from '../src/theme/fonts';

interface Membership {
  id: number;
  planName: string | null;
  clubName: string | null;
  status: string;
  isActive: boolean;
  startDate: string;
  endDate: string | null;
  signUpDate: string;
  cancelDate: string | null;
  automaticRenew: boolean;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-HK', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

function daysLeft(endDate: string | null): number | null {
  if (!endDate) return null;
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
}

function StatusBadge({ m }: { m: Membership }) {
  const days = daysLeft(m.endDate);
  if (m.isActive) {
    const color = days !== null && days <= 30 ? colors.cta : colors.success;
    return (
      <View style={[badge.wrap, { backgroundColor: color + '18' }]}>
        <View style={[badge.dot, { backgroundColor: color }]} />
        <Text style={[badge.text, { color }]}>
          {days !== null ? `${days} days left` : 'Active'}
        </Text>
      </View>
    );
  }
  return (
    <View style={[badge.wrap, { backgroundColor: colors.textMuted + '15' }]}>
      <Text style={[badge.text, { color: colors.textMuted }]}>Ended</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  dot:  { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 12, fontFamily: fonts.semibold },
});

function MembershipCard({ m }: { m: Membership }) {
  return (
    <View style={[s.card, m.isActive && s.cardActive]}>
      {m.isActive && <View style={s.activeBar} />}
      <View style={s.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.planName} numberOfLines={2}>
            {m.planName ?? 'Unknown Plan'}
          </Text>
          {m.clubName && (
            <View style={s.clubRow}>
              <Ionicons name="location" size={12} color={colors.primary} />
              <Text style={s.clubName}>{m.clubName}</Text>
            </View>
          )}
        </View>
        <StatusBadge m={m} />
      </View>

      <View style={s.datesGrid}>
        <View style={s.dateItem}>
          <Text style={s.dateLabel}>Sign-up</Text>
          <Text style={s.dateValue}>{fmtDate(m.signUpDate)}</Text>
        </View>
        <View style={s.dateItem}>
          <Text style={s.dateLabel}>Start</Text>
          <Text style={s.dateValue}>{fmtDate(m.startDate)}</Text>
        </View>
        <View style={s.dateItem}>
          <Text style={s.dateLabel}>Expires</Text>
          <Text style={[s.dateValue, !m.endDate && { color: colors.textMuted }]}>
            {m.endDate ? fmtDate(m.endDate) : 'Open-ended'}
          </Text>
        </View>
        {m.cancelDate && (
          <View style={s.dateItem}>
            <Text style={s.dateLabel}>Cancelled</Text>
            <Text style={[s.dateValue, { color: colors.error }]}>{fmtDate(m.cancelDate)}</Text>
          </View>
        )}
      </View>

      {m.automaticRenew && m.isActive && (
        <View style={s.renewRow}>
          <Ionicons name="refresh-circle-outline" size={14} color={colors.success} />
          <Text style={s.renewText}>Auto-renews</Text>
        </View>
      )}
    </View>
  );
}

export default function MembershipScreen() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get<Membership[]>('/me/memberships');
      setMemberships(data);
    } catch {
      setError('Unable to load memberships');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const current = memberships.filter(m => m.isActive);
  const ended   = memberships.filter(m => !m.isActive);

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={s.title}>My Memberships</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.border} />
          <Text style={s.errorText}>{error}</Text>
          <Pressable style={s.retryBtn} onPress={() => load()}>
            <Text style={s.retryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={[]}
          keyExtractor={() => ''}
          renderItem={() => null}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
          }
          ListHeaderComponent={
            <>
              {current.length > 0 && (
                <>
                  <Text style={s.sectionLabel}>CURRENT</Text>
                  {current.map(m => <MembershipCard key={m.id} m={m} />)}
                </>
              )}
              {ended.length > 0 && (
                <>
                  <Text style={s.sectionLabel}>ENDED</Text>
                  {ended.map(m => <MembershipCard key={m.id} m={m} />)}
                </>
              )}
              {memberships.length === 0 && (
                <View style={s.empty}>
                  <Ionicons name="card-outline" size={48} color={colors.border} />
                  <Text style={s.emptyTitle}>No memberships found</Text>
                  <Text style={s.emptySub}>Contact the gym to set up your membership</Text>
                </View>
              )}
            </>
          }
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bg },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:   { fontSize: 17, fontFamily: fonts.bold, color: colors.text },

  scroll: { padding: 16, gap: 0, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 11, fontFamily: fonts.bold, color: colors.primary,
    letterSpacing: 1.5, marginBottom: 10, marginTop: 8,
  },

  card: {
    backgroundColor: colors.card, borderRadius: 14,
    marginBottom: 12, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardActive:   { borderColor: colors.primary + '40' },
  activeBar:    { height: 3, backgroundColor: colors.primary },

  cardTop:      { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 10 },
  planName:     { fontSize: 16, fontFamily: fonts.bold, color: colors.text, flex: 1 },
  clubRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  clubName:     { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted },

  datesGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, paddingBottom: 14, gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    paddingTop: 12,
  },
  dateItem:  { minWidth: 90 },
  dateLabel: { fontSize: 11, fontFamily: fonts.regular, color: colors.textMuted, marginBottom: 2 },
  dateValue: { fontSize: 13, fontFamily: fonts.semibold, color: colors.text },

  renewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  renewText: { fontSize: 12, fontFamily: fonts.regular, color: colors.success },

  errorText:  { fontSize: 14, fontFamily: fonts.regular, color: colors.textMuted },
  retryBtn:   { borderWidth: 1, borderColor: colors.primary, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  retryText:  { fontSize: 14, fontFamily: fonts.semibold, color: colors.primary },

  empty:      { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textMuted },
  emptySub:   { fontSize: 13, fontFamily: fonts.regular, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 32 },
});
