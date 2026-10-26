import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Animated, Dimensions, Pressable, RefreshControl,
  ScrollView, SectionList, StyleSheet, Text, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { apiClient } from '../../src/api/client';
import { colors, fonts, spacing, radius, shadows, type as t } from '../../src/theme';
import { ScreenWrapper, EmptyState } from '../../src/components';

const { width: W } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivityType = 'class' | 'pt' | 'checkin';
type Tab = 'GX' | 'PT' | 'VISITS';
type Range = 'Week' | 'Month' | 'Year';

interface ActivityItem {
  id: string; type: ActivityType;
  title: string; subtitle: string | null;
  at: string; club: string | null;
}
interface Summary {
  classesTotal: number; ptTotal: number; checkinsTotal: number;
  streakWeeks: number; streakDays: number;
  thisMonth: { classes: number; pt: number; checkins: number };
}
interface ActivityResponse {
  summary: Summary; items: ActivityItem[]; errors?: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-HK', { hour: '2-digit', minute: '2-digit', hour12: false });
}
function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-HK', { weekday: 'short', day: 'numeric' });
}
function monthKey(iso: string) {
  return new Date(iso).toLocaleDateString('en-HK', { year: 'numeric', month: 'long' });
}

// ─── Animated Tab Bar ─────────────────────────────────────────────────────────

const TABS: Tab[] = ['GX', 'PT', 'VISITS'];
const TAB_W = (W - spacing.base * 2) / TABS.length;

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const slideAnim = useRef(new Animated.Value(TABS.indexOf(active) * TAB_W)).current;

  function select(tab: Tab) {
    onChange(tab);
    Animated.spring(slideAnim, {
      toValue: TABS.indexOf(tab) * TAB_W,
      useNativeDriver: true, damping: 20, stiffness: 200,
    }).start();
  }

  return (
    <View style={tb.wrap}>
      {/* sliding underline */}
      <Animated.View style={[tb.indicator, { transform: [{ translateX: slideAnim }], width: TAB_W }]} />
      {TABS.map(tab => (
        <Pressable key={tab} style={tb.tab} onPress={() => select(tab)}>
          <Text style={[tb.label, active === tab && tb.labelActive]}>{tab}</Text>
        </Pressable>
      ))}
    </View>
  );
}
const tb = StyleSheet.create({
  wrap:      { flexDirection: 'row', marginHorizontal: spacing.base, marginBottom: spacing.md,
               borderBottomWidth: 1, borderBottomColor: colors.border },
  tab:       { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  label:     { fontSize: 13, fontFamily: fonts.bold, color: colors.textMuted, letterSpacing: 0.5 },
  labelActive:{ color: colors.primary },
  indicator: { position: 'absolute', bottom: -1, height: 2, backgroundColor: colors.primary, borderRadius: 1 },
});

// ─── Range Toggle ─────────────────────────────────────────────────────────────

const RANGES: Range[] = ['Week', 'Month', 'Year'];

function RangeToggle({ active, onChange }: { active: Range; onChange: (r: Range) => void }) {
  return (
    <View style={rt.wrap}>
      {RANGES.map(r => (
        <Pressable key={r} style={[rt.btn, active === r && rt.btnActive]} onPress={() => onChange(r)}>
          <Text style={[rt.txt, active === r && rt.txtActive]}>{r}</Text>
        </Pressable>
      ))}
    </View>
  );
}
const rt = StyleSheet.create({
  wrap:      { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: radius.full,
               padding: 3, marginHorizontal: spacing.base, marginBottom: spacing.md },
  btn:       { flex: 1, paddingVertical: 7, borderRadius: radius.full, alignItems: 'center' },
  btnActive: { backgroundColor: colors.card, ...shadows.card },
  txt:       { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted },
  txtActive: { color: colors.text, fontFamily: fonts.bold },
});

// ─── Streak Hero Card ─────────────────────────────────────────────────────────

function StreakCard({ streak, days }: { streak: number; days: ActivityItem[] }) {
  // Build 7-day dot row (last 7 days)
  const today = new Date();
  const dots = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const key = d.toDateString();
    const hasActivity = days.some(item => new Date(item.at).toDateString() === key);
    const isToday = i === 6;
    return { key, hasActivity, isToday };
  });

  return (
    <LinearGradient
      colors={[colors.primaryMid, colors.primaryDark]}
      start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
      style={sc.card}
    >
      <View style={sc.c1} /><View style={sc.c2} />
      <View style={sc.top}>
        <View>
          <Text style={sc.eyebrow}>WEEKLY STREAK</Text>
          <View style={sc.numRow}>
            <Text style={sc.num}>{streak}</Text>
            <Text style={sc.unit}>weeks</Text>
          </View>
        </View>
        <View style={[sc.iconBox, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
          <Ionicons name="flame" size={28} color="#fff" />
        </View>
      </View>
      <Text style={sc.sub}>
        {streak >= 4 ? "You're one of GO24's most dedicated members!" :
         streak >= 2 ? 'Keep showing up — build that habit!' :
         'Visit this week to start your streak.'}
      </Text>
      {/* 7-day dots */}
      <View style={sc.dotsRow}>
        {dots.map((d, i) => (
          <View key={d.key} style={sc.dotCol}>
            <View style={[
              sc.dot,
              d.hasActivity && sc.dotFilled,
              d.isToday && !d.hasActivity && sc.dotToday,
            ]} />
            <Text style={sc.dotLabel}>
              {['M','T','W','T','F','S','S'][(new Date(d.key).getDay() + 6) % 7]}
            </Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}
const sc = StyleSheet.create({
  card: { marginHorizontal: spacing.base, borderRadius: radius.xl + 4, padding: spacing.lg + 2, gap: spacing.md,
          overflow: 'hidden', ...shadows.card },
  c1:  { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.06)', top: -60, right: -40 },
  c2:  { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.04)', bottom: -30, left: 10 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { fontSize: 10, fontFamily: fonts.bold, color: 'rgba(255,255,255,0.55)', letterSpacing: 2 },
  numRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  num:     { fontSize: 52, fontFamily: fonts.black, color: '#fff', lineHeight: 56 },
  unit:    { fontSize: 16, fontFamily: fonts.semibold, color: 'rgba(255,255,255,0.7)', marginBottom: spacing.sm },
  iconBox: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  sub:     { fontSize: 13, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.7)', lineHeight: 19 },
  dotsRow: { flexDirection: 'row', gap: spacing.sm },
  dotCol:  { flex: 1, alignItems: 'center', gap: spacing.xs },
  dot:     { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)' },
  dotFilled: { backgroundColor: '#fff', borderColor: '#fff' },
  dotToday:  { borderColor: '#fff' },
  dotLabel:  { fontSize: 9, fontFamily: fonts.bold, color: 'rgba(255,255,255,0.5)' },
});

// ─── Stat Cards Row ───────────────────────────────────────────────────────────

function StatCards({ summary }: { summary: Summary }) {
  const items = [
    { label: 'CHECK-INS', val: summary.checkinsTotal, color: colors.primary, icon: 'walk-outline' as const },
    { label: 'CLASSES',   val: summary.classesTotal,  color: colors.indigo,  icon: 'barbell-outline' as const },
    { label: 'PT',        val: summary.ptTotal,        color: colors.teal,   icon: 'fitness-outline' as const },
  ];
  return (
    <View style={stc.row}>
      {items.map(it => (
        <View key={it.label} style={stc.card}>
          <View style={[stc.icon, { backgroundColor: it.color + '15' }]}>
            <Ionicons name={it.icon} size={16} color={it.color} />
          </View>
          <Text style={stc.val}>{it.val}</Text>
          <Text style={stc.lbl}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}
const stc = StyleSheet.create({
  row:  { flexDirection: 'row', marginHorizontal: spacing.base, gap: spacing.sm },
  card: { flex: 1, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.base, gap: spacing.xs, ...shadows.card },
  icon: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  val:  { fontSize: 28, fontFamily: fonts.black, color: colors.text },
  lbl:  { fontSize: 9, fontFamily: fonts.bold, color: colors.textMuted, letterSpacing: 0.8 },
});

// ─── Bar Chart ────────────────────────────────────────────────────────────────

function BarChart({ items, color }: { items: ActivityItem[]; color: string }) {
  // Group by day of week
  const counts = Array(7).fill(0);
  items.forEach(item => {
    const day = (new Date(item.at).getDay() + 6) % 7; // Mon=0
    counts[day]++;
  });
  const max = Math.max(...counts, 1);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <View style={bc.wrap}>
      <Text style={bc.title}>WEEKLY PATTERN</Text>
      <View style={bc.bars}>
        {counts.map((c, i) => (
          <View key={i} style={bc.col}>
            <View style={bc.barWrap}>
              <View style={[bc.bar, { height: `${(c / max) * 100}%` as any, backgroundColor: c > 0 ? color : colors.border }]} />
            </View>
            <Text style={bc.label}>{days[i][0]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
const bc = StyleSheet.create({
  wrap:   { backgroundColor: colors.card, marginHorizontal: spacing.base, borderRadius: radius.xl, padding: spacing.base, ...shadows.card },
  title:  { fontSize: 10, fontFamily: fonts.bold, color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.md },
  bars:   { flexDirection: 'row', height: 80, alignItems: 'flex-end', gap: spacing.xs },
  col:    { flex: 1, alignItems: 'center', gap: spacing.xs },
  barWrap:{ flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar:    { width: '100%', borderRadius: 3, minHeight: 3 },
  label:  { fontSize: 9, fontFamily: fonts.semibold, color: colors.textMuted },
});

// ─── Club Breakdown ───────────────────────────────────────────────────────────

function ClubBreakdown({ items }: { items: ActivityItem[] }) {
  const counts = new Map<string, number>();
  for (const item of items.filter(i => i.club)) {
    counts.set(item.club!, (counts.get(item.club!) ?? 0) + 1);
  }
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (top.length === 0) return null;
  const max = top[0][1];

  return (
    <View style={cl.wrap}>
      <Text style={cl.title}>TOP CLUBS</Text>
      {top.map(([club, count], i) => (
        <View key={club} style={cl.row}>
          <View style={[cl.dot, { backgroundColor: i === 0 ? colors.primary : colors.textMuted }]} />
          <Text style={cl.name} numberOfLines={1}>{club}</Text>
          <View style={cl.barWrap}>
            <View style={[cl.bar, { width: `${(count / max) * 100}%` as any, backgroundColor: i === 0 ? colors.primary : colors.border }]} />
          </View>
          <Text style={cl.count}>{count}</Text>
        </View>
      ))}
    </View>
  );
}
const cl = StyleSheet.create({
  wrap:   { backgroundColor: colors.card, marginHorizontal: spacing.base, borderRadius: radius.xl, padding: spacing.base, gap: spacing.md, ...shadows.card },
  title:  { fontSize: 10, fontFamily: fonts.bold, color: colors.textMuted, letterSpacing: 1.5 },
  row:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot:    { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  name:   { fontSize: 13, fontFamily: fonts.semibold, color: colors.text, width: 110 },
  barWrap:{ flex: 1, height: 6, backgroundColor: colors.bg, borderRadius: 3, overflow: 'hidden' },
  bar:    { height: '100%', borderRadius: 3 },
  count:  { fontSize: 13, fontFamily: fonts.bold, color: colors.textMuted, minWidth: 20, textAlign: 'right' },
});

// ─── Activity Card ────────────────────────────────────────────────────────────

const TYPE_ICON: Record<ActivityType, React.ComponentProps<typeof Ionicons>['name']> = {
  class:   'barbell-outline',
  pt:      'fitness-outline',
  checkin: 'walk-outline',
};
const TYPE_COLOR: Record<ActivityType, string> = {
  class:   colors.indigo,
  pt:      colors.teal,
  checkin: colors.primary,
};
const TYPE_BG: Record<ActivityType, string> = {
  class:   colors.indigoBg,
  pt:      colors.tealBg,
  checkin: colors.primaryBg,
};

function ActivityCard({ item }: { item: ActivityItem }) {
  return (
    <View style={ac.row}>
      <View style={[ac.icon, { backgroundColor: TYPE_BG[item.type] }]}>
        <Ionicons name={TYPE_ICON[item.type]} size={18} color={TYPE_COLOR[item.type]} />
      </View>
      <View style={ac.body}>
        <Text style={ac.title}>{item.title}</Text>
        <View style={ac.meta}>
          {item.subtitle && (
            <View style={[ac.badge, { backgroundColor: TYPE_BG[item.type] }]}>
              <Text style={[ac.badgeTxt, { color: TYPE_COLOR[item.type] }]}>{item.subtitle}</Text>
            </View>
          )}
          {item.club && <Text style={ac.club} numberOfLines={1}>{item.club}</Text>}
        </View>
      </View>
      <View style={ac.time}>
        <Text style={ac.day}>{fmtDay(item.at)}</Text>
        <Text style={ac.hour}>{fmtTime(item.at)}</Text>
      </View>
    </View>
  );
}
const ac = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: spacing.md,
              backgroundColor: colors.card, paddingHorizontal: spacing.base, paddingVertical: spacing.md - 2 },
  icon:     { width: 42, height: 42, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  body:     { flex: 1, gap: spacing.xs },
  title:    { ...t.bodyBold, color: colors.text },
  meta:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  badge:    { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: spacing.xs },
  badgeTxt: { fontSize: 11, fontFamily: fonts.semibold },
  club:     { ...t.caption, color: colors.textMuted, flex: 1 },
  time:     { alignItems: 'flex-end', gap: 2 },
  day:      { ...t.caption, color: colors.textMuted },
  hour:     { ...t.label, color: colors.text },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ActivityScreen() {
  const [data, setData]         = useState<ActivityResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab]           = useState<Tab>('GX');
  const [range, setRange]       = useState<Range>('Month');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const { data: res } = await apiClient.get<ActivityResponse>('/activity');
      setData(res);
    } catch { /* silent */ } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const allItems = data?.items ?? [];

  // Filter items by tab
  const tabItems = useMemo(() => {
    if (tab === 'GX')     return allItems.filter(i => i.type === 'class');
    if (tab === 'PT')     return allItems.filter(i => i.type === 'pt');
    if (tab === 'VISITS') return allItems.filter(i => i.type === 'checkin');
    return allItems;
  }, [allItems, tab]);

  // Group by month for SectionList
  const sections = useMemo(() => {
    const map = new Map<string, ActivityItem[]>();
    for (const item of tabItems) {
      const key = monthKey(item.at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  }, [tabItems]);

  const summary   = data?.summary;
  const streak    = summary?.streakWeeks ?? 0;
  const tabColor  = tab === 'GX' ? colors.indigo : tab === 'PT' ? colors.teal : colors.primary;

  return (
    <ScreenWrapper barStyle="dark-content">
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Activity</Text>
          <Text style={s.subtitle}>Last 12 months</Text>
        </View>
        <Ionicons name="trophy-outline" size={22} color={colors.amber} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <ActivityCard item={item} />}
        renderSectionHeader={({ section }) => (
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            <View style={s.sectionBadge}>
              <Text style={s.sectionCount}>{section.data.length}</Text>
            </View>
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
            {/* Streak hero */}
            {streak > 0 && <StreakCard streak={streak} days={allItems} />}

            {/* All-time stats */}
            {summary && <StatCards summary={summary} />}

            {/* Tab bar */}
            <TabBar active={tab} onChange={setTab} />

            {/* Range toggle */}
            <RangeToggle active={range} onChange={setRange} />

            {/* Bar chart */}
            {tabItems.length > 0 && <BarChart items={tabItems} color={tabColor} />}

            {/* Club breakdown for checkins */}
            {tab === 'VISITS' && <ClubBreakdown items={tabItems} />}
          </View>
        }
        ItemSeparatorComponent={() => (
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 70 }} />
        )}
        SectionSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          loading ? undefined : (
            <View style={{ padding: spacing.xl }}>
              <EmptyState
                icon="pulse-outline"
                title="No activity yet"
                subtitle={`No ${tab === 'GX' ? 'classes' : tab === 'PT' ? 'PT sessions' : 'check-ins'} recorded`}
              />
            </View>
          )
        }
      />
    </ScreenWrapper>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.base, paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  title:    { fontSize: 26, fontFamily: fonts.black, color: colors.text },
  subtitle: { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 2 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.base, paddingVertical: spacing.sm,
    backgroundColor: colors.bg,
  },
  sectionTitle: { fontSize: 13, fontFamily: fonts.bold, color: colors.textMuted },
  sectionBadge: { backgroundColor: colors.primaryBg, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  sectionCount: { fontSize: 11, fontFamily: fonts.bold, color: colors.primary },
});
