import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, FlatList, Pressable,
  RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CalendarList } from 'react-native-calendars';
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

const TYPE_ICON: Record<ActivityType, string> = {
  class:   '🏋️',
  pt:      '💪',
  checkin: '🚪',
};

const TYPE_LABEL: Record<ActivityType, string> = {
  class:   'Class',
  pt:      'PT',
  checkin: 'Check-in',
};

const FILTER_LABELS: { key: Filter; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'class',   label: 'Classes' },
  { key: 'pt',      label: 'PT' },
  { key: 'checkin', label: 'Check-ins' },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-HK', { month: 'short', day: 'numeric', weekday: 'short' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit', hour12: false });
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
    <View style={s.typeCard}>
      <Text style={s.typeTitle}>Class Types</Text>
      {top.map(([name, count]) => (
        <View key={name} style={s.typeRow}>
          <Text style={s.typeName} numberOfLines={1}>{name}</Text>
          <View style={s.typeBarWrap}>
            <View style={[s.typeBar, { width: `${(count / max) * 100}%` as any }]} />
          </View>
          <Text style={s.typeCount}>{count}</Text>
        </View>
      ))}
    </View>
  );
}

function ClubSummary({ items }: { items: ActivityItem[] }) {
  const counts = new Map<string, number>();
  for (const item of items.filter(i => i.type === 'checkin' && item.club)) {
    counts.set(item.club!, (counts.get(item.club!) ?? 0) + 1);
  }
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (top.length === 0) return null;
  const max = top[0][1];

  return (
    <View style={s.typeCard}>
      <Text style={s.typeTitle}>Clubs Visited</Text>
      {top.map(([club, count]) => (
        <View key={club} style={s.typeRow}>
          <Text style={s.typeName} numberOfLines={1}>{club}</Text>
          <View style={s.typeBarWrap}>
            <View style={[s.typeBar, { width: `${(count / max) * 100}%` as any, backgroundColor: colors.teal ?? colors.primary }]} />
          </View>
          <Text style={s.typeCount}>{count}</Text>
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
          <Text style={s.summaryNum}>{summary.thisMonth.checkins}</Text>
          <Text style={s.summaryLabel}>Check-ins 🚪</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <Text style={s.summaryNum}>{summary.thisMonth.classes}</Text>
          <Text style={s.summaryLabel}>Classes 🏋️</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <Text style={s.summaryNum}>{summary.thisMonth.pt}</Text>
          <Text style={s.summaryLabel}>PT Sessions 💪</Text>
        </View>
      </View>

      {summary.streakDays > 0 && (
        <View style={s.streakBar}>
          <Text style={s.streakText}>🔥 {summary.streakDays}-day streak</Text>
        </View>
      )}

      <View style={s.totalRow}>
        <Text style={s.totalText}>
          Last 3 months: {summary.checkinsTotal} check-ins · {summary.classesTotal} classes · {summary.ptTotal} PT
        </Text>
      </View>
    </View>
  );
}

function ActivityCard({ item }: { item: ActivityItem }) {
  return (
    <View style={s.card}>
      <View style={s.cardIcon}>
        <Text style={s.icon}>{TYPE_ICON[item.type]}</Text>
      </View>
      <View style={s.cardBody}>
        <Text style={s.cardTitle}>{item.title}</Text>
        {item.subtitle && <Text style={s.cardSub}>{item.subtitle}</Text>}
      </View>
      <View style={s.cardTime}>
        <Text style={s.timeDate}>{formatDate(item.at)}</Text>
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
  const [view, setView] = useState<'list' | 'calendar'>('list');

  // Build heatmap marked dates from activity items
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    for (const item of data?.items ?? []) {
      const key = item.at.slice(0, 10);
      const count = (marks[key]?.count ?? 0) + 1;
      marks[key] = {
        count,
        selected: true,
        selectedColor:
          count >= 3 ? colors.primaryDark
          : count === 2 ? colors.primary
          : colors.primary + 'AA',
      };
    }
    return marks;
  }, [data]);

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

  const filtered = data?.items.filter(
    i => filter === 'all' || i.type === filter,
  ) ?? [];

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
          <Text style={s.subtitle}>Last 3 months</Text>
        </View>
        <Pressable
          style={[s.viewToggle, view === 'calendar' && s.viewToggleActive]}
          onPress={() => setView(v => v === 'list' ? 'calendar' : 'list')}
          hitSlop={8}
        >
          <Ionicons
            name={view === 'calendar' ? 'list-outline' : 'calendar-outline'}
            size={18}
            color={view === 'calendar' ? '#fff' : colors.primary}
          />
        </Pressable>
      </View>

      {view === 'calendar' && (
        <CalendarList
          markedDates={markedDates}
          markingType="custom"
          pastScrollRange={6}
          futureScrollRange={0}
          scrollEnabled
          showScrollIndicator
          theme={{
            backgroundColor: colors.bg,
            calendarBackground: colors.bg,
            selectedDayBackgroundColor: colors.primary,
            todayTextColor: colors.primary,
            dayTextColor: colors.text,
            textDisabledColor: colors.border,
            monthTextColor: colors.text,
            textMonthFontFamily: fonts.bold,
            textDayFontFamily: fonts.regular,
            textDayFontSize: 13,
          } as any}
        />
      )}

      {error ? (
        <View style={s.errorBar}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      {view === 'list' && <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <ActivityCard item={item} />}
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
            {(filter === 'all' || filter === 'class') && (
              <ClassTypeSummary items={data?.items ?? []} />
            )}
            {filter === 'checkin' && (
              <ClubSummary items={data?.items ?? []} />
            )}
          </>
        }
        ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 16 }} />}
        contentContainerStyle={{ backgroundColor: colors.card }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="pulse-outline" size={40} color={colors.border} />
            <Text style={s.emptyText}>No records yet</Text>
          </View>
        }
      />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: colors.bg },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewToggle: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primaryBg,
    alignItems: 'center', justifyContent: 'center',
  },
  viewToggleActive: { backgroundColor: colors.primary },
  header:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  title:    { fontSize: 28, fontFamily: fonts.black, color: colors.text },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 2 },

  summaryCard: {
    backgroundColor: colors.card, marginHorizontal: 16, borderRadius: 14,
    padding: 16, gap: 10, marginBottom: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  summaryRow:   { flexDirection: 'row', alignItems: 'center' },
  summaryItem:  { flex: 1, alignItems: 'center', gap: 4 },
  summaryNum:   { fontSize: 28, fontFamily: fonts.black, color: colors.primary },
  summaryLabel: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted, textAlign: 'center' },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 40, backgroundColor: colors.border },
  streakBar: {
    backgroundColor: '#FFF5F5', borderRadius: 8,
    paddingVertical: 8, alignItems: 'center',
  },
  streakText:   { color: colors.primary, fontFamily: fonts.bold, fontSize: 14 },
  totalRow:     { alignItems: 'center' },
  totalText:    { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted },

  filterRow:    { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginVertical: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText:       { fontSize: 13, fontFamily: fonts.semibold, color: colors.textMuted },
  filterTextActive: { color: '#fff' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 14,
  },
  cardIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center',
  },
  icon:      { fontSize: 18 },
  cardBody:  { flex: 1, gap: 2 },
  cardTitle: { fontSize: 14, fontFamily: fonts.bold,    color: colors.text },
  cardSub:   { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted },
  cardTime:  { alignItems: 'flex-end', gap: 2 },
  timeDate:  { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted },
  timeHour:  { fontSize: 12, fontFamily: fonts.semibold, color: colors.text },

  errorBar: {
    margin: 16, backgroundColor: '#FFF0F0', borderRadius: 8, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  errorText: { color: colors.error, fontFamily: fonts.regular, fontSize: 13 },
  warnBar: {
    marginHorizontal: 16, marginBottom: 4, backgroundColor: colors.amberBg, borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  warnText: { color: colors.amber, fontFamily: fonts.regular, fontSize: 12, flex: 1 },
  empty:     { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 15 },

  typeCard: {
    backgroundColor: colors.card, marginHorizontal: 16, marginBottom: 4,
    borderRadius: 14, padding: 16, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  typeTitle:   { fontSize: 13, fontFamily: fonts.bold, color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  typeRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeName:    { fontSize: 13, fontFamily: fonts.semibold, color: colors.text, width: 130 },
  typeBarWrap: { flex: 1, height: 6, backgroundColor: colors.bg, borderRadius: 3, overflow: 'hidden' },
  typeBar:     { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  typeCount:   { fontSize: 13, fontFamily: fonts.bold, color: colors.primary, minWidth: 20, textAlign: 'right' },
});
