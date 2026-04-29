import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, FlatList, Pressable,
  RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../src/api/client';
import { colors } from '../../src/theme/colors';

type Tab = 'personal' | 'announcements';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

interface NotifResponse {
  items: NotificationItem[];
  unread: number;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return '剛才';
  if (m < 60) return `${m} 分鐘前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小時前`;
  return `${Math.floor(h / 24)} 日前`;
}

function NotifCard({
  item,
  onPress,
}: {
  item: NotificationItem;
  onPress: (id: string) => void;
}) {
  const unread = !item.readAt;
  return (
    <Pressable
      style={[s.card, unread && s.cardUnread]}
      onPress={() => onPress(item.id)}
    >
      {unread && <View style={s.dot} />}
      <View style={s.cardBody}>
        <Text style={[s.cardTitle, !unread && s.cardTitleRead]}>{item.title}</Text>
        <Text style={s.cardText}>{item.body}</Text>
        <Text style={s.cardTime}>{timeAgo(item.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const [tab, setTab] = useState<Tab>('personal');
  const [data, setData] = useState<NotifResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const { data: res } = await apiClient.get<NotifResponse>('/notifications', {
        params: { tab },
      });
      setData(res);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const handlePress = useCallback(async (id: string) => {
    await apiClient.patch(`/notifications/${id}/read`);
    setData(prev => prev ? {
      ...prev,
      unread: Math.max(0, prev.unread - 1),
      items: prev.items.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n),
    } : null);
  }, []);

  const handleMarkAll = useCallback(async () => {
    await apiClient.patch('/notifications/read-all');
    setData(prev => prev ? {
      ...prev,
      unread: 0,
      items: prev.items.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
    } : null);
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const unread = data?.unread ?? 0;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>
          通知{unread > 0 ? ` (${unread})` : ''}
        </Text>
        {unread > 0 && (
          <Pressable onPress={handleMarkAll}>
            <Text style={s.markAll}>全部已讀</Text>
          </Pressable>
        )}
      </View>

      <View style={s.tabRow}>
        {(['personal', 'announcements'] as Tab[]).map(t => (
          <Pressable
            key={t}
            style={[s.tabBtn, tab === t && s.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'personal' ? '我的' : '公告'}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={data?.items ?? []}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <NotifCard item={item} onPress={handlePress} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>未有通知</Text>
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
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  title:   { fontSize: 28, fontWeight: '800', color: colors.text },
  markAll: { fontSize: 14, color: colors.primary, fontWeight: '600' },

  tabRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 4, gap: 8 },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  tabBtnActive:  { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText:       { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  tabTextActive: { color: colors.bg },

  card: {
    flexDirection: 'row', gap: 10,
    backgroundColor: colors.card, borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: colors.border,
  },
  cardUnread: { borderColor: colors.primary + '55' },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primary, marginTop: 5,
  },
  cardBody:      { flex: 1, gap: 4 },
  cardTitle:     { fontSize: 14, fontWeight: '800', color: colors.text },
  cardTitleRead: { fontWeight: '600', color: colors.textMuted },
  cardText:      { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  cardTime:      { fontSize: 11, color: colors.textMuted },

  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: colors.textMuted },
});
