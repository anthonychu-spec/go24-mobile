import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, FlatList, Pressable,
  RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../src/api/client';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';

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
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const { data: res } = await apiClient.get<NotifResponse>('/notifications', {
        params: { tab },
      });
      setData(res);
    } catch {
      setError('Unable to load notifications');
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

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
    </SafeAreaView>
  );

  if (error) return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Notifications</Text>
      </View>
      <View style={s.errorState}>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.border} />
        <Text style={s.errorStateTitle}>Unable to load</Text>
        <Text style={s.errorStateSub}>{error}</Text>
        <Pressable style={s.retryBtn} onPress={() => load()}>
          <Text style={s.retryText}>Try Again</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );

  const unread = data?.unread ?? 0;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>
          Notifications{unread > 0 ? ` (${unread})` : ''}
        </Text>
        {unread > 0 && (
          <Pressable onPress={handleMarkAll}>
            <Text style={s.markAll}>Mark all read</Text>
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
              {t === 'personal' ? 'Personal' : 'Announcements'}
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
        ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 16 }} />}
        contentContainerStyle={{ backgroundColor: colors.card }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="notifications-outline" size={40} color={colors.border} />
            <Text style={s.emptyText}>No notifications</Text>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  title:   { fontSize: 28, fontFamily: fonts.black, color: colors.text },
  markAll: { fontSize: 14, fontFamily: fonts.semibold, color: colors.primary },

  tabRow: { flexDirection: 'row', marginHorizontal: 16, marginVertical: 12, gap: 8 },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  tabBtnActive:  { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText:       { fontSize: 14, fontFamily: fonts.bold, color: colors.textMuted },
  tabTextActive: { color: '#fff' },

  card: {
    flexDirection: 'row', gap: 12,
    backgroundColor: colors.card,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  dot: {
    width: 8, height: 8, borderRadius: 4, marginTop: 6,
    backgroundColor: colors.primary,
  },
  cardBody:      { flex: 1, gap: 3 },
  cardTitle:     { fontSize: 14, fontFamily: fonts.bold,    color: colors.text },
  cardTitleRead: { fontFamily: fonts.semibold, color: colors.textMuted },
  cardText:      { fontSize: 13, fontFamily: fonts.regular, color: colors.textMuted, lineHeight: 19 },
  cardTime:      { fontSize: 11, fontFamily: fonts.regular, color: colors.textMuted },

  empty:     { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 15, fontFamily: fonts.regular, color: colors.textMuted },

  errorState:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  errorStateTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textMuted },
  errorStateSub:   { fontSize: 13, fontFamily: fonts.regular, color: colors.textMuted, textAlign: 'center' },
  retryBtn: {
    marginTop: 8, borderWidth: 1, borderColor: colors.primary,
    borderRadius: 20, paddingHorizontal: 24, paddingVertical: 9,
  },
  retryText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.primary },
});
