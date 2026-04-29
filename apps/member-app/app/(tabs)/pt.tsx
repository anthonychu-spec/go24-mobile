import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, FlatList, Pressable,
  RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { apiClient } from '../../src/api/client';
import { colors } from '../../src/theme/colors';

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
    return new Date(iso).toLocaleDateString('zh-HK', {
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
          {daysLeft > 0 ? `剩 ${daysLeft} 日` : '已到期'}
        </Text>
      </View>

      <View style={s.sessionsRow}>
        <Text style={s.remaining}>{a.remainingSessions}</Text>
        <Text style={s.sessionLabel}>/ {a.totalSessions} 堂剩餘</Text>
      </View>

      <View style={s.progressBg}>
        <View style={[s.progressFill, { width: `${pct}%` as any }]} />
      </View>

      <Text style={s.expiry}>到期：{formatDate(a.endDate)}</Text>
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
          <Text style={s.verifiedText}>✅ 已簽名</Text>
        </View>
      ) : (
        <Pressable style={s.signBtn} onPress={() => onSign(session)}>
          <Text style={s.signBtnText}>簽名確認</Text>
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
          <Text style={[s.tabText, tab === 'agreements' && s.tabTextActive]}>Agreement</Text>
        </Pressable>
        <Pressable
          style={[s.tabBtn, tab === 'sessions' && s.tabBtnActive]}
          onPress={() => setTab('sessions')}
        >
          <Text style={[s.tabText, tab === 'sessions' && s.tabTextActive]}>歷史</Text>
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
          ListEmptyComponent={<Text style={s.empty}>未有 PT Agreement</Text>}
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
          ListEmptyComponent={<Text style={s.empty}>未有 PT 記錄</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: colors.bg },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:   { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title:    { fontSize: 28, fontWeight: '800', color: colors.text },

  tabRow:         { flexDirection: 'row', marginHorizontal: 16, marginBottom: 4, gap: 8 },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  tabBtnActive:   { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText:        { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  tabTextActive:  { color: colors.bg },

  agreementCard: {
    backgroundColor: colors.card, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: colors.border, gap: 8,
  },
  agreementHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  agreementTitle:  { fontSize: 15, fontWeight: '700', color: colors.text },
  daysLeft:        { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  sessionsRow:     { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  remaining:       { fontSize: 36, fontWeight: '900', color: colors.primary },
  sessionLabel:    { fontSize: 14, color: colors.textMuted },
  progressBg: {
    height: 6, backgroundColor: colors.border,
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill:    { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  expiry:          { fontSize: 12, color: colors.textMuted },

  sessionRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: colors.border, gap: 12,
  },
  sessionDate:    { fontSize: 14, fontWeight: '700', color: colors.text },
  sessionSub:     { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  verifiedBadge: {
    backgroundColor: colors.success + '22',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  verifiedText:   { color: colors.success, fontWeight: '700', fontSize: 12 },
  signBtn: {
    backgroundColor: colors.primary, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  signBtnText:    { color: colors.bg, fontWeight: '700', fontSize: 13 },
  empty:          { textAlign: 'center', color: colors.textMuted, marginTop: 40, fontSize: 15 },
});
