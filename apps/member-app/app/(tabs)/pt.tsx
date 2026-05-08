import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, FlatList, Pressable,
  RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../src/api/client';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';

interface Agreement {
  id: number;
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  startDate: string;
  endDate: string;
  trainerId: number;
  status: string;
}

interface PtSession {
  id: number;
  date: string;
  trainerId: number;
  agreementId: number;
  status: string;
  verified: boolean;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-HK', {
      month: 'short', day: 'numeric', weekday: 'short',
    });
  } catch { return iso; }
}

function AgreementCard({ a }: { a: Agreement }) {
  const pct = a.totalSessions > 0
    ? Math.round((a.usedSessions / a.totalSessions) * 100)
    : 0;
  const expiry = new Date(a.endDate);
  const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / 86400000);

  return (
    <View style={s.agreementCard}>
      <View style={s.agreementHeader}>
        <Text style={s.agreementTitle}>PT Agreement #{a.id}</Text>
        <Text style={[s.daysLeft, daysLeft < 30 && { color: colors.error }]}>
          {daysLeft > 0 ? `${daysLeft} days left` : 'Expired'}
        </Text>
      </View>

      <View style={s.sessionsRow}>
        <Text style={s.remaining}>{a.remainingSessions}</Text>
        <Text style={s.sessionLabel}>/ {a.totalSessions} sessions left</Text>
      </View>

      <View style={s.progressBg}>
        <View style={[s.progressFill, { width: `${pct}%` as any }]} />
      </View>

      <Text style={s.expiry}>Expires: {formatDate(a.endDate)}</Text>
    </View>
  );
}

function SessionRow({
  session,
  onSign,
}: {
  session: PtSession;
  onSign: (s: PtSession) => void;
}) {
  return (
    <View style={s.sessionRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.sessionDate}>{formatDate(session.date)}</Text>
        <Text style={s.sessionSub}>Trainer #{session.trainerId}</Text>
      </View>
      {session.verified ? (
        <View style={s.verifiedBadge}>
          <Text style={s.verifiedText}>✅ Signed</Text>
        </View>
      ) : (
        <Pressable style={s.signBtn} onPress={() => onSign(session)}>
          <Text style={s.signBtnText}>Sign</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function PtScreen() {
  const router = useRouter();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [sessions, setSessions] = useState<PtSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'agreements' | 'sessions'>('agreements');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [ag, se] = await Promise.allSettled([
        apiClient.get<Agreement[]>('/pt/agreements'),
        apiClient.get<PtSession[]>('/pt/sessions'),
      ]);
      if (ag.status === 'fulfilled') setAgreements(ag.value.data);
      if (se.status === 'fulfilled') setSessions(se.value.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSign = useCallback((session: PtSession) => {
    router.push({
      pathname: '/pt/sign',
      params: {
        sessionId: String(session.id),
        trainerId: String(session.trainerId),
        agreementId: String(session.agreementId),
      },
    });
  }, [router]);

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
        <Text style={s.title}>PT Sessions</Text>
      </View>

      <View style={s.tabRow}>
        <Pressable
          style={[s.tabBtn, tab === 'agreements' && s.tabBtnActive]}
          onPress={() => setTab('agreements')}
        >
          <Text style={[s.tabText, tab === 'agreements' && s.tabTextActive]}>Agreements</Text>
        </Pressable>
        <Pressable
          style={[s.tabBtn, tab === 'sessions' && s.tabBtnActive]}
          onPress={() => setTab('sessions')}
        >
          <Text style={[s.tabText, tab === 'sessions' && s.tabTextActive]}>History</Text>
        </Pressable>
      </View>

      {tab === 'agreements' ? (
        <FlatList
          data={agreements}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => <AgreementCard a={item} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
          }
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Ionicons name="barbell-outline" size={40} color={colors.border} />
              <Text style={s.emptyTitle}>No PT agreements</Text>
              <Text style={s.emptySub}>Contact the gym to set up a PT package</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <SessionRow session={item} onSign={handleSign} />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
          }
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Ionicons name="time-outline" size={40} color={colors.border} />
              <Text style={s.emptyTitle}>No PT sessions yet</Text>
              <Text style={s.emptySub}>Your completed sessions will appear here</Text>
            </View>
          }
        />
      )}
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

  tabRow: { flexDirection: 'row', marginHorizontal: 16, marginVertical: 12, gap: 8 },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  tabBtnActive:  { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText:       { fontSize: 14, fontFamily: fonts.bold, color: colors.textMuted },
  tabTextActive: { color: '#fff' },

  agreementCard: {
    backgroundColor: colors.card, borderRadius: 14, marginHorizontal: 16,
    padding: 16, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  agreementHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  agreementTitle:  { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  daysLeft:        { fontSize: 13, fontFamily: fonts.semibold, color: colors.textMuted },
  sessionsRow:     { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  remaining:       { fontSize: 36, fontFamily: fonts.black, color: colors.primary },
  sessionLabel:    { fontSize: 14, fontFamily: fonts.regular, color: colors.textMuted },
  progressBg:      { height: 5, backgroundColor: colors.bg, borderRadius: 3, overflow: 'hidden' },
  progressFill:    { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  expiry:          { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted },

  sessionRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  sessionDate: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  sessionSub:  { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 2 },
  verifiedBadge: {
    backgroundColor: colors.success + '18',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  verifiedText: { color: colors.success, fontFamily: fonts.bold, fontSize: 12 },
  signBtn: {
    backgroundColor: colors.primary, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  signBtnText: { color: '#fff', fontFamily: fonts.bold, fontSize: 13 },
  empty:      { textAlign: 'center', fontFamily: fonts.regular, color: colors.textMuted, marginTop: 40, fontSize: 15 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: fonts.bold,    color: colors.textMuted },
  emptySub:   { fontSize: 13, fontFamily: fonts.regular, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 32 },
});
