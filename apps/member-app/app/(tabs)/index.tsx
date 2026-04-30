import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator, Dimensions, FlatList, Image, Linking,
  Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/context';
import { apiClient } from '../../src/api/client';
import { colors } from '../../src/theme/colors';

const { width: SCREEN_W } = Dimensions.get('window');

interface Banner {
  id: string;
  title: string | null;
  imageUrl: string;
  linkUrl: string | null;
}

interface DashboardData {
  user: { name: string | null; email: string | null };
  membership: {
    active: boolean;
    planName: string | null;
    daysRemaining: number | null;
    expiresAt: string | null;
  };
  pt: { remainingSessions: number; totalSessions: number; expiresAt: string | null };
  nextClass: {
    bookingId: string; classId: number; startTime: string;
    minutesUntil: number; clubName: string | null;
  } | null;
  thisMonth: { visits: number; classes: number; pt: number };
  unreadNotifications: number;
}

function formatCountdown(minutes: number): string {
  if (minutes <= 0) return '已開始';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} 分鐘後`;
  if (h < 24) return `${h} 小時 ${m > 0 ? `${m} 分鐘` : ''}後`;
  const d = Math.floor(h / 24);
  return `${d} 日後`;
}

// ── Components ────────────────────────────────────────────────────────────

function GreetingHeader({ name, unread }: { name: string | null; unread: number }) {
  const router = useRouter();
  const hour = new Date().getHours();
  const greet = hour < 6 ? '夜晚好' : hour < 12 ? '早晨' : hour < 18 ? '下午好' : '夜晚好';
  return (
    <View style={s.headerRow}>
      <View>
        <Text style={s.greet}>{greet}{name ? `，${name}` : ''}</Text>
        <Text style={s.logo}>GO24</Text>
      </View>
      <Pressable style={s.bellWrap} onPress={() => router.push('/(tabs)/notifications')}>
        <Text style={s.bell}>🔔</Text>
        {unread > 0 && (
          <View style={s.badge}><Text style={s.badgeText}>{unread > 9 ? '9+' : unread}</Text></View>
        )}
      </Pressable>
    </View>
  );
}

function NextClassCard({ next }: { next: DashboardData['nextClass'] }) {
  const router = useRouter();
  if (!next) {
    return (
      <Pressable style={s.nextCardEmpty} onPress={() => router.push('/(tabs)/classes')}>
        <Text style={s.nextEmptyIcon}>📅</Text>
        <Text style={s.nextEmptyTitle}>未有預約</Text>
        <Text style={s.nextEmptySub}>立即 book 堂</Text>
      </Pressable>
    );
  }
  return (
    <Pressable style={s.nextCard} onPress={() => router.push('/(tabs)/bookings')}>
      <View style={s.nextHeader}>
        <Text style={s.nextLabel}>下一堂</Text>
        <Text style={s.nextCountdown}>⏱ {formatCountdown(next.minutesUntil)}</Text>
      </View>
      <Text style={s.nextClassName}>Class #{next.classId}</Text>
      <Text style={s.nextClassTime}>
        {new Date(next.startTime).toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit', hour12: false })}
        {next.clubName && ` · ${next.clubName}`}
      </Text>
    </Pressable>
  );
}

function StatsRow({ data }: { data: DashboardData }) {
  const m = data.membership;
  const pt = data.pt;
  return (
    <View style={s.statsRow}>
      <View style={[s.stat, m.daysRemaining != null && m.daysRemaining < 30 && s.statWarn]}>
        <Text style={s.statNum}>{m.daysRemaining ?? '—'}</Text>
        <Text style={s.statLabel}>會籍剩餘日</Text>
      </View>
      <View style={s.stat}>
        <Text style={s.statNum}>{pt.remainingSessions}</Text>
        <Text style={s.statLabel}>PT 餘堂</Text>
      </View>
      <View style={s.stat}>
        <Text style={s.statNum}>{data.thisMonth.visits}</Text>
        <Text style={s.statLabel}>本月入場 🔥</Text>
      </View>
    </View>
  );
}

function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [current, setCurrent] = useState(0);
  if (banners.length === 0) return null;
  return (
    <View style={s.carouselWrap}>
      <FlatList
        data={banners}
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        keyExtractor={b => b.id}
        onMomentumScrollEnd={e => setCurrent(Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - 40)))}
        renderItem={({ item }) => (
          <Pressable
            style={s.bannerSlide}
            onPress={() => item.linkUrl && Linking.openURL(item.linkUrl)}
          >
            <Image source={{ uri: item.imageUrl }} style={s.bannerImage} resizeMode="cover" />
            {item.title && (
              <View style={s.bannerOverlay}>
                <Text style={s.bannerTitle}>{item.title}</Text>
              </View>
            )}
          </Pressable>
        )}
      />
      {banners.length > 1 && (
        <View style={s.dots}>
          {banners.map((_, i) => (
            <View key={i} style={[s.dot, i === current && s.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

function QuickActions() {
  const router = useRouter();
  const actions = [
    { icon: '📅', label: 'Book 堂',     to: '/(tabs)/classes' },
    { icon: '💪', label: 'PT',           to: '/(tabs)/pt' },
    { icon: '💳', label: '更新信用卡',   to: '/payment/update-card' },
    { icon: '🎁', label: '介紹朋友',     to: '/referral' },
  ];
  return (
    <View style={s.actionsGrid}>
      {actions.map(a => (
        <Pressable key={a.label} style={s.actionBtn} onPress={() => router.push(a.to as any)}>
          <Text style={s.actionIcon}>{a.icon}</Text>
          <Text style={s.actionLabel}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function MembershipAlert({ data }: { data: DashboardData }) {
  const router = useRouter();
  const days = data.membership.daysRemaining;
  if (days == null || days > 30) return null;
  const expired = days <= 0;
  return (
    <Pressable
      style={[s.alertCard, expired && s.alertCardExpired]}
      onPress={() => router.push('/payment/update-card')}
    >
      <Text style={s.alertIcon}>{expired ? '🚨' : '⚠️'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.alertTitle}>
          {expired ? '會籍已到期' : `會籍剩 ${days} 日`}
        </Text>
        <Text style={s.alertSub}>
          {expired ? '請即聯絡前台續會' : '建議盡早續會，避免影響使用'}
        </Text>
      </View>
      <Text style={s.alertArrow}>›</Text>
    </Pressable>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { logout } = useAuth();
  const [data, setData]     = useState<DashboardData | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading]       = useState(true);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [d, b] = await Promise.allSettled([
        apiClient.get<DashboardData>('/me/dashboard'),
        apiClient.get<Banner[]>('/banners'),
      ]);
      if (d.status === 'fulfilled') setData(d.value.data);
      if (b.status === 'fulfilled') setBanners(b.value.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
      >
        <GreetingHeader name={data?.user.name ?? null} unread={data?.unreadNotifications ?? 0} />
        {data && <MembershipAlert data={data} />}
        {data && <NextClassCard next={data.nextClass} />}
        {data && <StatsRow data={data} />}
        <BannerCarousel banners={banners} />
        <QuickActions />

        <Pressable style={s.logoutBtn} onPress={logout}>
          <Text style={s.logoutText}>登出</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },

  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greet:    { fontSize: 14, color: colors.textMuted },
  logo:     { fontSize: 32, fontWeight: '900', color: colors.primary, letterSpacing: 4, marginTop: 2 },
  bellWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  bell:     { fontSize: 20 },
  badge: {
    position: 'absolute', top: 4, right: 4,
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Membership alert
  alertCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFA50022', borderWidth: 1, borderColor: '#FFA50055',
    borderRadius: 12, padding: 14,
  },
  alertCardExpired: { backgroundColor: colors.error + '22', borderColor: colors.error + '55' },
  alertIcon:  { fontSize: 24 },
  alertTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  alertSub:   { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  alertArrow: { fontSize: 22, color: colors.textMuted },

  // Next class
  nextCard: {
    backgroundColor: colors.card, borderRadius: 16, padding: 18, gap: 6,
    borderWidth: 1, borderColor: colors.border,
  },
  nextHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nextLabel:  { fontSize: 12, color: colors.textMuted, fontWeight: '700', letterSpacing: 1 },
  nextCountdown: { fontSize: 13, color: colors.primary, fontWeight: '800' },
  nextClassName: { fontSize: 22, fontWeight: '900', color: colors.text, marginTop: 2 },
  nextClassTime: { fontSize: 14, color: colors.textMuted },

  nextCardEmpty: {
    backgroundColor: colors.card, borderRadius: 16, padding: 22,
    alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border,
    borderStyle: 'dashed',
  },
  nextEmptyIcon:  { fontSize: 28 },
  nextEmptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  nextEmptySub:   { fontSize: 12, color: colors.primary },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1, backgroundColor: colors.card, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  statWarn:  { borderColor: colors.error + '88' },
  statNum:   { fontSize: 24, fontWeight: '900', color: colors.primary },
  statLabel: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },

  // Banner
  carouselWrap: { borderRadius: 14, overflow: 'hidden' },
  bannerSlide:  { width: SCREEN_W - 40, height: 140 },
  bannerImage:  { width: '100%', height: '100%' },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end', padding: 12,
  },
  bannerTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 },
  dot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 18 },

  // Quick actions grid
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: {
    width: (SCREEN_W - 50) / 2, backgroundColor: colors.card, borderRadius: 14,
    paddingVertical: 18, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border,
  },
  actionIcon:  { fontSize: 26 },
  actionLabel: { fontSize: 13, fontWeight: '700', color: colors.text },

  // Logout
  logoutBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginTop: 8,
  },
  logoutText: { color: colors.textMuted, fontSize: 14 },
});
