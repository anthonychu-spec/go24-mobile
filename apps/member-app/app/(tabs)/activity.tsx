import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, FlatList, Pressable,
  RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../src/api/client';
import { colors } from '../../src/theme/colors';

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
}

const TYPE_ICON: Record<ActivityType, string> = {
  class:   '🏋️',
  pt:      '💪',
  checkin: '🚪',
};

const TYPE_LABEL: Record<ActivityType, string> = {
  class:   '堂',
  pt:      'PT',
  checkin: '入場',
};

const FILTER_LABELS: { key: Filter; label: string }[] = [
  { key: 'all',     label: '全部' },
  { key: 'class',   label: '堂' },
  { key: 'pt',      label: 'PT' },
  { key: 'checkin', label: '入場' },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('zh-HK', { month: 'short', day: 'numeric', weekday: 'short' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function SummaryCard({ summary }: { summary: Summary }) {
  return (
    <View style={s.summaryCard}>
      <View style={s.summaryRow}>
        <View style={s.summaryItem}>
          <Text style={s.summaryNum}>{summary.thisMonth.checkins}</Text>
          <Text style={s.summaryLabel}>本月入場 🚪</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <Text style={s.summaryNum}>{summary.thisMonth.classes}</Text>
          <Text style={s.summaryLabel}>本月堂數 🏋️</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <Text style={s.summaryNum}>{summary.thisMonth.pt}</Text>
          <Text style={s.summaryLabel}>本月 PT 💪</Text>
        </View>
      </View>

      {summary.streakDays > 0 && (
        <View style={s.streakBar}>
          <Text style={s.streakText}>
            🔥 連續 {summary.streakDays} 日出席
          </Text>
        </View>
      )}

      <View style={s.totalRow}>
        <Text style={s.totalText}>
          過去3個月：{summary.checkinsTotal} 次入場・{summary.classesTotal} 堂・{summary.ptTotal} PT
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

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const { data: res } = await apiClient.get<ActivityResponse>('/activity');
      setData(res);
    } catch {
      setError('無法載入活動記錄');
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
        <Text style={s.title}>活動記錄</Text>
        <Text style={s.subtitle}>最近 3 個月</Text>
      </View>

      {error ? <View style={s.errorBar}><Text style={s.errorText}>{error}</Text></View> : null}

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <ActivityCard item={item} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <>
            {data?.summary && <SummaryCard summary={data.summary} />}
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
          </>
        }
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>未有記錄</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:       { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title:        { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle:     { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  summaryCard: {
    backgroundColor: colors.card, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: colors.border,
    marginBottom: 8, gap: 10,
  },
  summaryRow:   { flexDirection: 'row', alignItems: 'center' },
  summaryItem:  { flex: 1, alignItems: 'center', gap: 4 },
  summaryNum:   { fontSize: 28, fontWeight: '900', color: colors.primary },
  summaryLabel: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  summaryDivider: { width: 1, height: 40, backgroundColor: colors.border },
  streakBar: {
    backgroundColor: colors.primary + '18', borderRadius: 8,
    paddingVertical: 8, alignItems: 'center',
  },
  streakText:   { color: colors.primary, fontWeight: '700', fontSize: 14 },
  totalRow:     { alignItems: 'center' },
  totalText:    { fontSize: 12, color: colors.textMuted },

  filterRow:    { flexDirection: 'row', gap: 8, marginBottom: 4 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText:       { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  filterTextActive: { color: colors.bg },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: colors.border,
  },
  cardIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  icon:         { fontSize: 18 },
  cardBody:     { flex: 1, gap: 2 },
  cardTitle:    { fontSize: 14, fontWeight: '700', color: colors.text },
  cardSub:      { fontSize: 12, color: colors.textMuted },
  cardTime:     { alignItems: 'flex-end', gap: 2 },
  timeDate:     { fontSize: 12, color: colors.textMuted },
  timeHour:     { fontSize: 12, fontWeight: '600', color: colors.text },

  errorBar: {
    margin: 16, backgroundColor: colors.error + '22',
    borderRadius: 10, padding: 12, alignItems: 'center',
  },
  errorText:    { color: colors.error, fontSize: 13 },
  empty:        { alignItems: 'center', paddingTop: 40 },
  emptyText:    { color: colors.textMuted, fontSize: 15 },
});
