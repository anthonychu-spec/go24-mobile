import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Dimensions, FlatList, Image, Linking,
  Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/context';
import { apiClient } from '../../src/api/client';
import { colors } from '../../src/theme/colors';

const { width: W } = Dimensions.get('window');

interface Banner { id: string; title: string | null; imageUrl: string; linkUrl: string | null }
interface DashboardData {
  user: { name: string | null; email: string | null };
  membership: { active: boolean; planName: string | null; daysRemaining: number | null; expiresAt: string | null };
  pt: { remainingSessions: number; totalSessions: number; expiresAt: string | null };
  nextClass: { bookingId: string; classId: number; startTime: string; minutesUntil: number; clubName: string | null } | null;
  thisMonth: { visits: number; classes: number; pt: number };
  unreadNotifications: number;
}

function countdown(min: number) {
  if (min <= 0) return '進行中';
  if (min < 60) return `${min}分鐘後`;
  const h = Math.floor(min / 60); const m = min % 60;
  if (h < 24) return `${h}小時${m > 0 ? `${m}分` : ''}後`;
  return `${Math.floor(h / 24)}日後`;
}

function GradientCard({ children, style }: { children: React.ReactNode; style?: any }) {
  if (Platform.OS === 'web') {
    return (
      <View style={[{ backgroundColor: colors.primary, borderRadius: 20 }, style]}>
        {children}
      </View>
    );
  }
  return (
    <LinearGradient
      colors={['#B5001E', '#7A0012']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius: 20 }, style]}
    >
      {children}
    </LinearGradient>
  );
}

export default function HomeScreen() {
  const { logout } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bannerIdx, setBannerIdx] = useState(0);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [d, b] = await Promise.allSettled([
        apiClient.get<DashboardData>('/me/dashboard'),
        apiClient.get<Banner[]>('/banners'),
      ]);
      if (d.status === 'fulfilled') setData(d.value.data);
      if (b.status === 'fulfilled') setBanners(b.value.data);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const hour = new Date().getHours();
  const greet = hour < 12 ? '早晨' : hour < 18 ? '下午好' : '夜晚好';
  const name = data?.user?.name ?? data?.user?.email?.split('@')[0] ?? '';
  const m = data?.membership;
  const pt = data?.pt;
  const next = data?.nextClass;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.greet}>{greet}{name ? `，${name}` : ''}</Text>
            <Text style={s.brand}>GO24</Text>
          </View>
          <Pressable style={s.bell} onPress={() => router.push('/(tabs)/notifications')}>
            <Text style={s.bellIcon}>🔔</Text>
            {(data?.unreadNotifications ?? 0) > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>{data!.unreadNotifications}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* ── Membership expiry alert ── */}
        {m && m.daysRemaining != null && m.daysRemaining <= 30 && (
          <Pressable style={s.alert} onPress={() => router.push('/payment/update-card')}>
            <Text style={s.alertIcon}>{m.daysRemaining <= 0 ? '🚨' : '⚠️'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.alertTitle}>{m.daysRemaining <= 0 ? '會籍已到期' : `會籍剩 ${m.daysRemaining} 日`}</Text>
              <Text style={s.alertSub}>點擊更新信用卡</Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 20 }}>›</Text>
          </Pressable>
        )}

        {/* ── Next class hero card ── */}
        <GradientCard style={s.heroCard}>
          <Text style={s.heroLabel}>下一堂</Text>
          {next ? (
            <>
              <Text style={s.heroClass}>Class #{next.classId}</Text>
              <View style={s.heroBottom}>
                <Text style={s.heroTime}>
                  {new Date(next.startTime).toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  {next.clubName ? ` · ${next.clubName}` : ''}
                </Text>
                <View style={s.heroBadge}>
                  <Text style={s.heroBadgeText}>⏱ {countdown(next.minutesUntil)}</Text>
                </View>
              </View>
            </>
          ) : (
            <Pressable onPress={() => router.push('/(tabs)/classes')}>
              <Text style={s.heroEmpty}>未有預約 — 立即 Book 堂</Text>
              <Text style={s.heroEmptyArrow}>→</Text>
            </Pressable>
          )}
        </GradientCard>

        {/* ── Stats ── */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={[s.statNum, { color: (m?.daysRemaining ?? 99) < 30 ? colors.cta : '#fff' }]}>
              {m?.daysRemaining ?? '—'}
            </Text>
            <Text style={s.statLabel}>會籍剩餘日</Text>
          </View>
          <View style={[s.statCard, { borderColor: colors.primary + '60' }]}>
            <Text style={s.statNum}>{pt?.remainingSessions ?? 0}</Text>
            <Text style={s.statLabel}>PT 餘堂</Text>
          </View>
          <View style={[s.statCard, { borderColor: colors.primary + '60' }]}>
            <Text style={[s.statNum, { color: colors.cta }]}>{data?.thisMonth.visits ?? 0}</Text>
            <Text style={s.statLabel}>本月入場 🔥</Text>
          </View>
        </View>

        {/* ── Quick actions ── */}
        <Text style={s.sectionTitle}>快速操作</Text>
        <View style={s.actionsGrid}>
          {[
            { icon: '📅', label: 'Book 堂',    to: '/(tabs)/classes',    accent: colors.cta },
            { icon: '💪', label: 'PT Sessions', to: '/(tabs)/pt',         accent: colors.primary },
            { icon: '📋', label: '我的預約',    to: '/(tabs)/bookings',   accent: colors.primary },
            { icon: '📊', label: '活動記錄',    to: '/(tabs)/activity',   accent: colors.primary },
            { icon: '💳', label: '更新信用卡',  to: '/payment/update-card', accent: colors.textMuted },
            { icon: '🎁', label: '介紹朋友',    to: '/referral',          accent: colors.cta },
          ].map(a => (
            <Pressable key={a.label} style={s.actionCard} onPress={() => router.push(a.to as any)}>
              <View style={[s.actionIconWrap, { backgroundColor: a.accent + '20', borderColor: a.accent + '40' }]}>
                <Text style={s.actionIcon}>{a.icon}</Text>
              </View>
              <Text style={s.actionLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Banners ── */}
        {banners.length > 0 && (
          <>
            <Text style={s.sectionTitle}>推廣優惠</Text>
            <FlatList
              data={banners}
              horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              keyExtractor={b => b.id}
              onMomentumScrollEnd={e => setBannerIdx(Math.round(e.nativeEvent.contentOffset.x / (W - 40)))}
              renderItem={({ item }) => (
                <Pressable style={s.banner} onPress={() => item.linkUrl && Linking.openURL(item.linkUrl)}>
                  <Image source={{ uri: item.imageUrl }} style={s.bannerImg} resizeMode="cover" />
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
                {banners.map((_, i) => <View key={i} style={[s.dot, i === bannerIdx && s.dotActive]} />)}
              </View>
            )}
          </>
        )}

        {/* ── Logout ── */}
        <Pressable style={s.logout} onPress={logout}>
          <Text style={s.logoutText}>登出</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, gap: 18, paddingBottom: 48 },

  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greet:    { fontSize: 13, color: colors.textMuted, letterSpacing: 0.5 },
  brand:    { fontSize: 38, fontWeight: '900', color: colors.primary, letterSpacing: 5, marginTop: 2 },
  bell:     { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  bellIcon: { fontSize: 20 },
  badge: {
    position: 'absolute', top: 4, right: 4,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },

  alert: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.primary + '18',
    borderWidth: 1, borderColor: colors.primary + '50',
    borderRadius: 14, padding: 14,
  },
  alertIcon:  { fontSize: 22 },
  alertTitle: { fontSize: 14, fontWeight: '800', color: '#fff' },
  alertSub:   { fontSize: 11, color: colors.textMuted, marginTop: 1 },

  heroCard:   { padding: 22, gap: 6, minHeight: 130 },
  heroLabel:  { fontSize: 11, color: 'rgba(255,255,255,0.65)', letterSpacing: 2, fontWeight: '700', textTransform: 'uppercase' },
  heroClass:  { fontSize: 28, fontWeight: '900', color: '#fff', marginTop: 4 },
  heroBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  heroTime:   { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  heroBadge:  { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  heroBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  heroEmpty:  { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.9)', marginTop: 8 },
  heroEmptyArrow: { fontSize: 24, color: 'rgba(255,255,255,0.6)', marginTop: 8 },

  statsRow:   { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 10, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  statNum:    { fontSize: 28, fontWeight: '900', color: '#fff' },
  statLabel:  { fontSize: 10, color: colors.textMuted, textAlign: 'center', fontWeight: '600', letterSpacing: 0.3 },

  sectionTitle: { fontSize: 12, color: colors.textMuted, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: {
    width: (W - 50) / 3, backgroundColor: colors.card,
    borderRadius: 16, padding: 14, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  actionIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  actionIcon:  { fontSize: 22 },
  actionLabel: { fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' },

  banner:      { width: W - 40, height: 150, borderRadius: 16, overflow: 'hidden' },
  bannerImg:   { width: '100%', height: '100%' },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', padding: 14 },
  bannerTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  dots:        { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot:         { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.border },
  dotActive:   { backgroundColor: colors.primary, width: 16 },

  logout:     { alignItems: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  logoutText: { color: colors.textMuted, fontSize: 13 },
});
