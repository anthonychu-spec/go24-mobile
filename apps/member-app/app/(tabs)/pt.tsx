import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../src/api/client';
import { colors, fonts, spacing, radius, shadows, type as ty } from '../../src/theme';
import { ScreenWrapper, EmptyState } from '../../src/components';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Agreement {
  id: number;
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  startDate: string;
  endDate: string;
  trainerId: number;
  trainerName?: string | null;
  status: string;
}

interface PtSession {
  id: number;
  date: string;
  trainerId: number;
  trainerName?: string | null;
  agreementId: number;
  status: string;
  verified: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-HK', { month: 'short', day: 'numeric' });
  } catch { return iso; }
}

function fmtDateLong(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-HK', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-HK', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return ''; }
}

// ─── Package Card ─────────────────────────────────────────────────────────────

function PackageCard({ a }: { a: Agreement }) {
  const pct = a.totalSessions > 0 ? Math.round((a.usedSessions / a.totalSessions) * 100) : 0;
  const daysLeft = Math.max(0, Math.ceil((new Date(a.endDate).getTime() - Date.now()) / 86400000));
  const lowBalance = a.remainingSessions <= 5;

  return (
    <View style={pc.card}>
      {/* Top row */}
      <View style={pc.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={pc.eyebrow}>ACTIVE PACKAGE</Text>
          <Text style={pc.title}>PT Agreement #{a.id}</Text>
        </View>
        <View style={pc.iconTile}>
          <Ionicons name="ticket-outline" size={18} color={colors.indigo} />
        </View>
      </View>

      {/* Progress block */}
      <View style={{ marginTop: spacing.base }}>
        <View style={pc.progressTop}>
          <View style={pc.numRow}>
            <Text style={pc.num}>{a.remainingSessions}</Text>
            <Text style={pc.numSub}>/ {a.totalSessions} left</Text>
          </View>
          <View style={[
            pc.pill,
            lowBalance ? { backgroundColor: colors.cta + '22' } : { backgroundColor: colors.bg },
          ]}>
            <Text style={[pc.pillTxt, { color: lowBalance ? colors.cta : colors.textMuted }]}>
              {lowBalance ? 'TOP UP SOON' : `${pct}% USED`}
            </Text>
          </View>
        </View>

        <View style={pc.bar}>
          <View style={[pc.barFill, { width: `${pct}%` as any }]} />
        </View>

        <View style={pc.footer}>
          <View style={pc.footerLeft}>
            <Ionicons name="time-outline" size={11} color={colors.textMuted} />
            <Text style={pc.footerTxt}>Expires {fmtDateLong(a.endDate)}</Text>
          </View>
          <Text style={[pc.footerTxt, daysLeft <= 30 && { color: colors.error }]}>
            {daysLeft} days left
          </Text>
        </View>
      </View>
    </View>
  );
}
const pc = StyleSheet.create({
  card:        { backgroundColor: colors.card, borderRadius: radius.xl + 4, padding: spacing.lg, ...shadows.card },
  topRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow:     { fontSize: 10, fontFamily: fonts.black, color: colors.textMuted, letterSpacing: 1.5 },
  title:       { fontSize: 18, fontFamily: fonts.black, color: colors.text, marginTop: 2 },
  iconTile:    { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.indigoBg, alignItems: 'center', justifyContent: 'center' },

  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  numRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  num:         { fontSize: 40, fontFamily: fonts.black, color: colors.text, lineHeight: 42 },
  numSub:      { fontSize: 12, fontFamily: fonts.black, color: colors.textMuted, marginBottom: 4 },
  pill:        { paddingHorizontal: spacing.sm + 2, paddingVertical: 4, borderRadius: radius.full },
  pillTxt:     { fontSize: 10, fontFamily: fonts.black, letterSpacing: 1 },

  bar:         { marginTop: spacing.md, height: 8, borderRadius: radius.full, backgroundColor: colors.bg, overflow: 'hidden' },
  barFill:     { height: '100%', backgroundColor: colors.indigo, borderRadius: radius.full },

  footer:      { marginTop: spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLeft:  { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  footerTxt:   { fontSize: 11, fontFamily: fonts.bold, color: colors.textMuted },
});

// ─── Quick Stats Row ──────────────────────────────────────────────────────────

function QuickStats({ a, coachCount }: { a: Agreement; coachCount: number }) {
  const items = [
    { icon: 'trophy-outline' as const, val: a.usedSessions,     lbl: 'COMPLETED' },
    { icon: 'flag-outline'   as const, val: a.remainingSessions, lbl: 'REMAINING' },
    { icon: 'person-outline' as const, val: coachCount,          lbl: 'COACHES' },
  ];
  return (
    <View style={qs.row}>
      {items.map(it => (
        <View key={it.lbl} style={qs.cell}>
          <Ionicons name={it.icon} size={14} color={colors.textMuted} />
          <Text style={qs.val}>{it.val}</Text>
          <Text style={qs.lbl}>{it.lbl}</Text>
        </View>
      ))}
    </View>
  );
}
const qs = StyleSheet.create({
  row:  { flexDirection: 'row', gap: spacing.sm },
  cell: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md + 4, padding: spacing.md, gap: 4, ...shadows.card },
  val:  { fontSize: 20, fontFamily: fonts.black, color: colors.text, marginTop: 4 },
  lbl:  { fontSize: 9, fontFamily: fonts.black, color: colors.textMuted, letterSpacing: 1, marginTop: 2 },
});

// ─── Pending Verification ─────────────────────────────────────────────────────

function PendingCard({ sessions, onSign }: { sessions: PtSession[]; onSign: (s: PtSession) => void }) {
  if (sessions.length === 0) return null;
  return (
    <View style={pv.card}>
      <View style={pv.header}>
        <View style={pv.headerLeft}>
          <View style={pv.iconBox}>
            <Ionicons name="create-outline" size={13} color={colors.cta} />
          </View>
          <Text style={pv.title}>Verify Attendance</Text>
        </View>
        <View style={pv.pill}>
          <Text style={pv.pillTxt}>{sessions.length} PENDING</Text>
        </View>
      </View>
      <Text style={pv.helper}>Sign to confirm your coach's session was completed.</Text>
      <View style={{ gap: spacing.sm }}>
        {sessions.map(s => (
          <View key={s.id} style={pv.row}>
            <View style={pv.rowIcon}>
              <Ionicons name="barbell-outline" size={15} color={colors.indigo} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={pv.rowTitle} numberOfLines={1}>
                PT Session
              </Text>
              <Text style={pv.rowMeta} numberOfLines={1}>
                {s.trainerName ?? `Trainer #${s.trainerId}`} · {fmtDate(s.date)} {fmtTime(s.date)}
              </Text>
            </View>
            <Pressable style={pv.signBtn} onPress={() => onSign(s)} hitSlop={6}>
              <Ionicons name="create-outline" size={12} color="#fff" />
              <Text style={pv.signTxt}>Sign</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}
const pv = StyleSheet.create({
  card:      { backgroundColor: colors.card, borderRadius: radius.xl + 4, padding: spacing.lg, ...shadows.card },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm + 2 },
  headerLeft:{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBox:   { width: 28, height: 28, borderRadius: radius.md - 2, backgroundColor: colors.cta + '22', alignItems: 'center', justifyContent: 'center' },
  title:     { fontSize: 12, fontFamily: fonts.black, color: colors.text },
  pill:      { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full, backgroundColor: colors.cta + '22' },
  pillTxt:   { fontSize: 10, fontFamily: fonts.black, color: colors.cta, letterSpacing: 1 },
  helper:    { fontSize: 11, fontFamily: fonts.bold, color: colors.textMuted, marginBottom: spacing.md - 2 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: spacing.md - 2, padding: 10, borderRadius: radius.md + 4, backgroundColor: colors.bg },
  rowIcon:   { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  rowTitle:  { fontSize: 13, fontFamily: fonts.black, color: colors.text },
  rowMeta:   { fontSize: 11, fontFamily: fonts.bold, color: colors.textMuted, marginTop: 2 },
  signBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: colors.text },
  signTxt:   { color: '#fff', fontSize: 11, fontFamily: fonts.black },
});

// ─── Coaches Card ─────────────────────────────────────────────────────────────

function CoachesCard({ sessions, totalUsed }: { sessions: PtSession[]; totalUsed: number }) {
  const counts = new Map<string, number>();
  for (const s of sessions.filter(x => x.verified)) {
    const name = s.trainerName ?? `Trainer #${s.trainerId}`;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;
  const base = totalUsed > 0 ? totalUsed : sorted[0][1];

  return (
    <View style={cc.card}>
      <Text style={cc.heading}>BY COACH</Text>
      <View style={{ gap: spacing.md }}>
        {sorted.map(([name, count]) => (
          <View key={name} style={cc.row}>
            <View style={cc.avatar}>
              <Ionicons name="person" size={14} color={colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={cc.topRow}>
                <Text style={cc.name} numberOfLines={1}>{name}</Text>
                <Text style={cc.count}>{count} sessions</Text>
              </View>
              <View style={cc.bar}>
                <View style={[cc.barFill, { width: `${Math.round((count / base) * 100)}%` as any }]} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
const cc = StyleSheet.create({
  card:    { backgroundColor: colors.card, borderRadius: radius.xl + 4, padding: spacing.lg, ...shadows.card },
  heading: { fontSize: 10, fontFamily: fonts.black, color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.md },
  row:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar:  { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  topRow:  { flexDirection: 'row', justifyContent: 'space-between' },
  name:    { fontSize: 13, fontFamily: fonts.black, color: colors.text },
  count:   { fontSize: 12, fontFamily: fonts.bold, color: colors.textMuted },
  bar:     { marginTop: 6, height: 6, borderRadius: radius.full, backgroundColor: colors.bg, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.indigo, borderRadius: radius.full },
});

// ─── Recent Sessions Card ─────────────────────────────────────────────────────

function RecentSessionsCard({ sessions }: { sessions: PtSession[] }) {
  const verified = sessions.filter(s => s.verified).slice(0, 5);
  if (verified.length === 0) return null;
  return (
    <View style={rs.card}>
      <View style={rs.header}>
        <Text style={rs.heading}>RECENT SESSIONS</Text>
        <Text style={rs.see}>See all ›</Text>
      </View>
      <View style={{ gap: spacing.sm }}>
        {verified.map(s => (
          <View key={s.id} style={rs.row}>
            <View style={rs.iconBox}>
              <Ionicons name="barbell-outline" size={15} color={colors.indigo} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={rs.title} numberOfLines={1}>PT Session</Text>
              <Text style={rs.meta} numberOfLines={1}>
                {s.trainerName ?? `Trainer #${s.trainerId}`}
              </Text>
            </View>
            <Text style={rs.date}>{fmtDate(s.date)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
const rs = StyleSheet.create({
  card:    { backgroundColor: colors.card, borderRadius: radius.xl + 4, padding: spacing.lg, ...shadows.card },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  heading: { fontSize: 10, fontFamily: fonts.black, color: colors.textMuted, letterSpacing: 1.5 },
  see:     { fontSize: 11, fontFamily: fonts.black, color: colors.primary },
  row:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md - 2, padding: 10, borderRadius: radius.md + 4 },
  iconBox: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.indigoBg, alignItems: 'center', justifyContent: 'center' },
  title:   { fontSize: 13, fontFamily: fonts.black, color: colors.text },
  meta:    { fontSize: 11, fontFamily: fonts.bold, color: colors.textMuted, marginTop: 2 },
  date:    { fontSize: 10, fontFamily: fonts.black, color: colors.textMuted },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PtScreen() {
  const router = useRouter();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [sessions, setSessions]     = useState<PtSession[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
        sessionId:   String(session.id),
        trainerId:   String(session.trainerId),
        agreementId: String(session.agreementId),
      },
    });
  }, [router]);

  const activeAgreement = agreements.find(a => a.status === 'active') ?? agreements[0];
  const pendingSessions = sessions.filter(s => !s.verified);
  const coachSet = new Set(sessions.filter(s => s.verified).map(s => s.trainerName ?? s.trainerId));

  if (loading) {
    return (
      <ScreenWrapper barStyle="dark-content">
        <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper barStyle="dark-content">
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>PT</Text>
          <Text style={s.subtitle}>Personal training, your way</Text>
        </View>
        <View style={s.headerIcon}>
          <Ionicons name="barbell-outline" size={16} color={colors.text} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {!activeAgreement ? (
          <EmptyState
            icon="barbell-outline"
            title="No PT package"
            subtitle="Contact the gym to set up a PT package"
          />
        ) : (
          <>
            <PackageCard a={activeAgreement} />
            <QuickStats a={activeAgreement} coachCount={coachSet.size} />
            <PendingCard sessions={pendingSessions} onSign={handleSign} />
            <CoachesCard sessions={sessions} totalUsed={activeAgreement.usedSessions} />
            <RecentSessionsCard sessions={sessions} />
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.md - 2,
  },
  title:      { fontSize: 26, fontFamily: fonts.black, color: colors.text },
  subtitle:   { fontSize: 12, fontFamily: fonts.bold, color: colors.textMuted, marginTop: 3 },
  headerIcon: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: 40, gap: spacing.lg },
});
