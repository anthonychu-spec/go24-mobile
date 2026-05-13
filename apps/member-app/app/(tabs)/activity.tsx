import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, FlatList, Pressable,
  RefreshControl, SectionList, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../src/api/client';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';

type ActivityType = 'class' | 'pt' | 'checkin';
type Filter = 'all' | ActivityType;

interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  subtitle: string | null;
  at: string;
  club: string | null;
}

interface Summary {
  classesTotal: number;
  ptTotal: number;
  checkinsTotal: number;
  streakDays: number;
  thisMonth: { classes: number; pt: number; checkins: number };
}

interface ActivityResponse {
  summary: Summary;
  items: ActivityItem[];
  errors?: string[];
}

// Ionicons — no emoji structural icons (ui-ux-pro-max: no-emoji-icons)
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

const FILTER_LABELS: { key: Filter; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'class',   label: 'Classes' },
  { key: 'pt',      label: 'PT' },
  { key: 'checkin', label: 'Check-ins' },
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-HK', { weekday: 'short', day: 'numeric' });
}

function getMonthKey(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-HK', { year: 'numeric', month: 'long' });
}

function ClassTypeSummary({ items }: { items: ActivityItem[] }) {
  const counts = new Map<string, number>();
  for (const item of items.filter(i => i.type === 'class')) {
    counts.set(item.title, (counts.get(item.title) ?? 0) + 1);
  }
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (top.length === 0) return null;
  const max = top[0][1];

  return (
    <View style={s.insightCard}>
      <Text style={s.insightTitle}>TOP CLASSES</Text>
      {top.map(([name, count]) => (
        <View key={name} style={s.barRow}>
          <Text style={s.barName} numberOfLines={1}>{name}</Text>
          <View style={s.barWrap}>
            <View style={[s.bar, { width: `${(count / max) * 100}%` as any, backgroundColor: colors.indigo }]} />
          </View>
          <Text style={[s.barCount, { color: colors.indigo }]}>{count}</Text>
        </View>
      ))}
    </View>
  );
}

function ClubSummary({ items }: { items: ActivityItem[] }) {
  const counts = new Map<string, number>();
  for (const item of items.filter(i => i.club)) {
    counts.set(item.club!, (counts.get(item.club!) ?? 0) + 1);
  }
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (top.length === 0) return null;
  const max = top[0][1];

  return (
    <View style={s.insightCard}>
      <Text style={s.insightTitle}>TOP CLUBS</Text>
      {top.map(([club, count]) => (
        <View key={club} style={s.barRow}>
          <Text style={s.barName} numberOfLines={1}>{club}</Text>
          <View style={s.barWrap}>
            <View style={[s.bar, { width: `${(count / max) * 100}%` as any, backgroundColor: colors.teal }]} />
          </View>
          <Text style={[s.barCount, { color: colors.teal }]}>{count}</Text>
        </View>
      ))}
    </View>
  );
}

function SummaryCard({ summary }: { summary: Summary }) {
  return (
    <View style={s.summaryCard}>
      <View style={s.summaryRow}>
        <View style={s.summaryItem}>
          <Ionicons name="walk-outline" size={20} color={colors.primary} />
          <Text style={[s.summaryNum, { color: colors.primary }]}>{summary.checkinsTotal}</Text>
          <Text style={s.summaryLabel}>Check-ins</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <Ionicons name="barbell-outline" size={20} color={colors.indigo} />
          <Text style={[s.summaryNum, { color: colors.indigo }]}>{summary.classesTotal}</Text>
          <Text style={s.summaryLabel}>Classes</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <Ionicons name="fitness-outline" size={20} color={colors.teal} />
          <Text style={[s.summaryNum, { color: colors.teal }]}>{summary.ptTotal}</Text>
          <Text style={s.summaryLabel}>PT Sessions</Text>
        </View>
      </View>

      {summary.streakDays > 0 && (
        <View style={s.streakBar}>
          <Ionicons name="flame" size={14} color={colors.cta} />
          <Text style={s.streakText}>{summary.streakDays}-day streak</Text>
        </View>
      )}

      <Text style={s.thisMonthText}>
        This month: {summary.thisMonth.classes} classes · {summary.thisMonth.checkins} check-ins · {summary.thisMonth.pt} PT
      </Text>
    </View>
  );
}

function ActivityCard({ item }: { item: ActivityItem }) {
  return (
    <View style={s.card}>
      <View style={[s.cardIcon, { backgroundColor: TYPE_BG[item.type] }]}>
        <Ionicons name={TYPE_ICON[item.type]} size={18} color={TYPE_COLOR[item.type]} />
      </View>
      <View style={s.cardBody}>
        <Text style={s.cardTitle}>{item.title}</Text>
        <View style={s.cardMeta}>
          {item.subtitle && (
            <View style={[s.badge, { backgroundColor: TYPE_BG[item.type] }]}>
              <Text style={[s.badgeText, { color: TYPE_COLOR[item.type] }]}>{item.subtitle}</Text>
            </View>
          )}
          {item.club && (
            <Text style={s.clubText} numberOfLines={1}>{item.club}</Text>
          )}
        </View>
      </View>
      <View style={s.cardTime}>
        <Text style={s.timeDay}>{formatDay(item.at)}</Text>
        <Text style={s.timeHour}>{formatTime(item.at)}</Text>
      </View>
    </View>
  );
}

export default function ActivityScreen() {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const { data: res } = await apiClient.get<ActivityResponse>('/activity');
      setData(res);
    } catch {
      setError('Unable to load activity');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() =>
    data?.items.filter(i => filter === 'all' || i.type === filter) ?? [],
  [data, filter]);

  // Group by month for SectionList
  const sections = useMemo(() => {
    const map = new Map<string, ActivityItem[]>();
    for (const item of filtered) {
      const key = getMonthKey(item.at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  }, [filtered]);

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
        <View>
          <Text style={s.title}>Activity</Text>
          <Text style={s.subtitle}>Last 12 months</Text>
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <ActivityCard item={item} />}
        renderSectionHeader={({ section }) => (
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            <Text style={s.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <>
            {data?.summary && <SummaryCard summary={data.summary} />}
            {(data?.errors?.length ?? 0) > 0 && (
              <View style={s.warnBar}>
                <Ionicons name="warning-outline" size={14} color={colors.amber} />
                <Text style={s.warnText}>Some data unavailable ({data!.errors!.join(', ')})</Text>
              </View>
            )}
            {error ? (
              <View style={s.errorBar}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}
            <View style={s.filterRow}>
              {FILTER_LABELS.map(f => (
                <Pressable
                  key={f.key}
                  style={[s.filterChip, filter === f.key && s.filterChipActive]}
                  onPress={() => setFilter(f.key)}
                >
                  <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {filter === 'class' && (
              <ClassTypeSummary items={data?.items ?? []} />
            )}
            {filter === 'checkin' && (
              <ClubSummary items={data?.items ?? []} />
            )}
          </>
        }
        ItemSeparatorComponent={() => (
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 70 }} />
        )}
        SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="pulse-outline" size={40} color={colors.border} />
            <Text style={s.emptyText}>No records yet</Text>
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
  title:    { fontSize: 28, fontFamily: fonts.black, color: colors.text },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 2 },

  // Summary
  summaryCard: {
    backgroundColor: colors.card, margin: 16, borderRadius: 16,
    padding: 16, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  summaryRow:     { flexDirection: 'row', alignItems: 'center' },
  summaryItem:    { flex: 1, alignItems: 'center', gap: 6 },
  summaryNum:     { fontSize: 32, fontFamily: fonts.black },
  summaryLabel:   { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted, textAlign: 'center' },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 48, backgroundColor: colors.border },
  streakBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.ctaBg, borderRadius: 8, paddingVertical: 8,
  },
  streakText:    { color: colors.cta, fontFamily: fonts.bold, fontSize: 14 },
  thisMonthText: { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted, textAlign: 'center' },

  // Filters
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText:       { fontSize: 13, fontFamily: fonts.semibold, color: colors.textMuted },
  filterTextActive: { color: '#fff' },

  // Insight cards (class types, clubs)
  insightCard: {
    backgroundColor: colors.card, marginHorizontal: 16, marginBottom: 12,
    borderRadius: 14, padding: 16, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  insightTitle: { fontSize: 11, fontFamily: fonts.bold, color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  barRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barName:  { fontSize: 13, fontFamily: fonts.semibold, color: colors.text, width: 120 },
  barWrap:  { flex: 1, height: 6, backgroundColor: colors.bg, borderRadius: 3, overflow: 'hidden' },
  bar:      { height: '100%', borderRadius: 3 },
  barCount: { fontSize: 13, fontFamily: fonts.bold, minWidth: 20, textAlign: 'right' },

  // Section headers
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: colors.bg,
  },
  sectionTitle: { fontSize: 13, fontFamily: fonts.bold, color: colors.textMuted },
  sectionCount: {
    fontSize: 11, fontFamily: fonts.bold, color: colors.primary,
    backgroundColor: colors.primaryBg, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10,
  },

  // Activity cards
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 12,
  },
  cardIcon: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody:  { flex: 1, gap: 4 },
  cardTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  cardMeta:  { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  badge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  badgeText: { fontSize: 11, fontFamily: fonts.semibold },
  clubText:  { fontSize: 11, fontFamily: fonts.regular, color: colors.textMuted, flex: 1 },
  cardTime:  { alignItems: 'flex-end', gap: 2 },
  timeDay:   { fontSize: 11, fontFamily: fonts.regular, color: colors.textMuted },
  timeHour:  { fontSize: 13, fontFamily: fonts.bold, color: colors.text },

  // Errors / warnings
  errorBar: {
    margin: 16, backgroundColor: '#FFF0F0', borderRadius: 8, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  errorText: { color: colors.error, fontFamily: fonts.regular, fontSize: 13 },
  warnBar: {
    marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.amberBg, borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  warnText: { color: colors.amber, fontFamily: fonts.regular, fontSize: 12, flex: 1 },

  empty:     { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 15 },
});
