import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../src/api/client';
import { colors, fonts, spacing, radius, shadows, type as ty } from '../../src/theme';
import { ScreenWrapper, EmptyState } from '../../src/components';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Type → visual style ──────────────────────────────────────────────────────

const TYPE_STYLE: Record<string, {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  iconBg: string;
  label: string;
}> = {
  booking:     { icon: 'calendar-outline',  iconColor: colors.primary,    iconBg: colors.primaryBg, label: 'BOOKING' },
  pt:          { icon: 'barbell-outline',   iconColor: colors.indigo,     iconBg: colors.indigoBg,  label: 'PT' },
  achievement: { icon: 'trophy-outline',    iconColor: colors.amber,      iconBg: colors.amberBg,   label: 'STREAK' },
  offer:       { icon: 'pricetag-outline',  iconColor: colors.cta,        iconBg: colors.ctaBg,     label: 'OFFER' },
  payment:     { icon: 'card-outline',      iconColor: colors.green,      iconBg: colors.greenBg,   label: 'PAYMENT' },
  account:     { icon: 'person-outline',    iconColor: colors.text,       iconBg: colors.bg,        label: 'ACCOUNT' },
  default:     { icon: 'notifications-outline', iconColor: colors.textMuted, iconBg: colors.bg,      label: 'INFO' },
};

function styleFor(type: string) {
  return TYPE_STYLE[type] ?? TYPE_STYLE.default;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-HK', { day: 'numeric', month: 'short' });
}

function dayGroup(iso: string): 'Today' | 'Yesterday' | 'Earlier' {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  const diff = (today.getTime() - d.getTime()) / 86400000;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return 'Earlier';
}

// ─── Notif Row ────────────────────────────────────────────────────────────────

function NotifRow({ item, onPress }: { item: NotificationItem; onPress: (id: string) => void }) {
  const unread = !item.readAt;
  const ts = styleFor(item.type);
  return (
    <Pressable style={nr.row} onPress={() => onPress(item.id)}>
      <View style={[nr.iconBox, { backgroundColor: ts.iconBg }]}>
        <Ionicons name={ts.icon} size={16} color={ts.iconColor} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={nr.titleRow}>
          <Text style={nr.title} numberOfLines={1}>{item.title}</Text>
          <Text style={nr.cat}>{ts.label}</Text>
        </View>
        <Text style={nr.body} numberOfLines={2}>{item.body}</Text>
        <Text style={nr.time}>{timeAgo(item.createdAt)}</Text>
      </View>
      {unread && <View style={nr.dot} />}
    </Pressable>
  );
}
const nr = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
              paddingHorizontal: spacing.base, paddingVertical: spacing.md + 2,
              position: 'relative' },
  iconBox:  { width: 40, height: 40, borderRadius: radius.md + 4, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title:    { fontSize: 13, fontFamily: fonts.black, color: colors.text, flexShrink: 1 },
  cat:      { fontSize: 9, fontFamily: fonts.black, color: colors.textMuted, letterSpacing: 1 },
  body:     { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  time:     { fontSize: 10, fontFamily: fonts.bold, color: colors.textMuted, marginTop: 6 },
  dot:      { position: 'absolute', top: spacing.base, right: spacing.base, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const [tab, setTab]             = useState<Tab>('personal');
  const [data, setData]           = useState<NotifResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const { data: res } = await apiClient.get<NotifResponse>('/notifications', { params: { tab } });
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
    await apiClient.patch(`/notifications/${id}/read`).catch(() => {});
    setData(prev => prev ? {
      ...prev,
      unread: Math.max(0, prev.unread - 1),
      items: prev.items.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n),
    } : null);
  }, []);

  const handleMarkAll = useCallback(async () => {
    if ((data?.unread ?? 0) === 0) return;
    await apiClient.patch('/notifications/read-all').catch(() => {});
    setData(prev => prev ? {
      ...prev,
      unread: 0,
      items: prev.items.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
    } : null);
  }, [data?.unread]);

  // Group items by day
  const groups = useMemo(() => {
    const items = data?.items ?? [];
    const map = new Map<string, NotificationItem[]>();
    for (const item of items) {
      const key = dayGroup(item.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return ['Today', 'Yesterday', 'Earlier']
      .map(k => ({ title: k, items: map.get(k) ?? [] }))
      .filter(g => g.items.length > 0);
  }, [data]);

  const unread = data?.unread ?? 0;
  const itemsCount = data?.items.length ?? 0;

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Notifications</Text>
            <Text style={s.subtitle}>
              {unread > 0 ? `${unread} unread` : 'All caught up'}
            </Text>
          </View>
          <Pressable
            style={[s.readAllBtn, unread === 0 && { opacity: 0.4 }]}
            onPress={handleMarkAll}
            disabled={unread === 0}
            hitSlop={6}
          >
            <Ionicons name="checkmark-done" size={13} color={colors.text} />
            <Text style={s.readAllTxt}>Read all</Text>
          </Pressable>
        </View>

        {/* Tab chips */}
        <View style={s.tabRow}>
          {(['personal', 'announcements'] as Tab[]).map(t => (
            <Pressable
              key={t}
              style={[s.tab, tab === t && s.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
                {t === 'personal' ? 'Personal' : 'Announcements'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : error ? (
        <View style={{ padding: spacing.xl }}>
          <EmptyState
            icon="cloud-offline-outline"
            title="Unable to load"
            subtitle={error}
            action="Try Again"
            onAction={() => load()}
          />
        </View>
      ) : itemsCount === 0 ? (
        <View style={{ padding: spacing.xl }}>
          <EmptyState
            icon="notifications-outline"
            title="You're all caught up"
            subtitle="New reminders and updates will appear here."
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {groups.map(group => (
            <View key={group.title} style={{ gap: spacing.sm }}>
              <Text style={s.groupLabel}>{group.title.toUpperCase()}</Text>
              <View style={s.groupCard}>
                {group.items.map((item, i) => (
                  <View key={item.id}>
                    <NotifRow item={item} onPress={handlePress} />
                    {i < group.items.length - 1 && <View style={s.divider} />}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </ScreenWrapper>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:    { paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.sm,
               backgroundColor: colors.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  title:     { fontSize: 26, fontFamily: fonts.black, color: colors.text },
  subtitle:  { fontSize: 12, fontFamily: fonts.bold, color: colors.textMuted, marginTop: 3 },
  readAllBtn:{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
               paddingHorizontal: spacing.md, height: 32, borderRadius: radius.full,
               backgroundColor: colors.bg },
  readAllTxt:{ fontSize: 11, fontFamily: fonts.black, color: colors.text },

  tabRow:   { flexDirection: 'row', gap: spacing.sm },
  tab:      { paddingHorizontal: spacing.md, height: 32, alignItems: 'center', justifyContent: 'center',
              borderRadius: radius.full, backgroundColor: colors.bg },
  tabActive:{ backgroundColor: colors.primary },
  tabTxt:   { fontSize: 12, fontFamily: fonts.black, color: colors.textMuted },
  tabTxtActive: { color: '#fff' },

  scroll:     { paddingHorizontal: spacing.base, paddingTop: spacing.lg, paddingBottom: 40, gap: spacing.lg },
  groupLabel: { fontSize: 10, fontFamily: fonts.black, color: colors.textMuted, letterSpacing: 1.5, paddingHorizontal: 4 },
  groupCard:  { backgroundColor: colors.card, borderRadius: radius.xl + 4, overflow: 'hidden', ...shadows.card },
  divider:    { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 70 },
});
