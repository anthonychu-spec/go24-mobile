import { useEffect, useState, useCallback } from 'react';
import {
  Dimensions, FlatList, Image, Linking,
  Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/context';
import { apiClient } from '../../src/api/client';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';

const { width: W } = Dimensions.get('window');

interface Banner { id: string; title: string | null; imageUrl: string; linkUrl: string | null }
interface DashboardData {
  user: { name: string | null; email: string | null };
  membership: { active: boolean; planName: string | null; daysRemaining: number | null; expiresAt: string | null };
  pt: { remainingSessions: number; totalSessions: number; expiresAt: string | null };
  nextClass: { bookingId: string; classId: number; className?: string | null; startTime: string; minutesUntil: number; clubName: string | null } | null;
  thisMonth: { visits: number; classes: number; pt: number };
  unreadNotifications: number;
}

function countdown(min: number) {
  if (min <= 0) return 'In progress';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60); const m = min % 60;
  if (h < 24) return `${h}h${m > 0 ? `${m}m` : ''}`;
  return `${Math.floor(h / 24)}d`;
}

function NextClassHero({ next, onBook }: {
  next: DashboardData['nextClass'] | null;
  onBook: () => void;
}) {
  if (!next) {
    return (
      <View style={s.emptyHero}>
        <View style={s.emptyHeroIcon}>
          <Ionicons name="calendar" size={28} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.emptyHeroTitle}>No upcoming classes</Text>
          <Text style={s.emptyHeroSub}>Ready to book your first class?</Text>
        </View>
        <Pressable style={s.emptyHeroBtn} onPress={onBook}>
          <Text style={s.emptyHeroBtnText}>Book</Text>
        </Pressable>
      </View>
    );
  }

  const time = new Date(next.startTime).toLocaleTimeString('en-HK', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const date = new Date(next.startTime).toLocaleDateString('en-HK', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  const content = (
    <View style={s.heroInner}>
      <Text style={s.heroEyebrow}>NEXT CLASS</Text>
      <Text style={s.heroClassName}>{next.className ?? `Class #${next.classId}`}</Text>
      <View style={s.heroMeta}>
        <View style={s.heroMetaItem}>
          <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.7)" />
          <Text style={s.heroMetaText}>{time}</Text>
        </View>
        <Text style={s.heroMetaDot}>·</Text>
        <View style={s.heroMetaItem}>
          <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.7)" />
          <Text style={s.heroMetaText}>{date}</Text>
        </View>
      </View>
      {next.clubName && (
        <View style={s.heroMetaItem}>
          <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.7)" />
          <Text style={s.heroMetaText}>{next.clubName}</Text>
        </View>
      )}
      <View style={s.heroBadge}>
        <Text style={s.heroBadgeText}>in {countdown(next.minutesUntil)}</Text>
      </View>
    </View>
  );

  if (Platform.OS === 'web') {
    return <View style={[s.heroCard, { backgroundColor: colors.primary }]}>{content}</View>;
  }
  return (
    <LinearGradient
      colors={['#C8001A', '#820012']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={s.heroCard}
    >
      {content}
    </LinearGradient>
  );
}

export default function HomeScreen() {
  const { logout } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [bannerIdx, setBannerIdx] = useState(0);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [d, b] = await Promise.allSettled([
        apiClient.get<DashboardData>('/me/dashboard'),
        apiClient.get<Banner[]>('/banners'),
      ]);
      if (d.status === 'fulfilled') setData(d.value.data);
      if (b.status === 'fulfilled') setBanners(b.value.data);
    } finally { setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const name = data?.user?.name?.split(' ')[0] ?? '';
  const m = data?.membership;
  const pt = data?.pt;
  const unread = data?.unreadNotifications ?? 0;

  const ACTIONS: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; to: string; }[] = [
    { icon: 'qr-code',         label: 'QR Check-in',    to: '/checkin/qr' },
    { icon: 'calendar',        label: 'Book a class',   to: '/(tabs)/classes' },
    { icon: 'bookmark',        label: 'My Bookings',    to: '/(tabs)/bookings' },
    { icon: 'barbell',         label: 'PT Sessions',    to: '/(tabs)/pt' },
    { icon: 'pulse',           label: 'Activity',       to: '/(tabs)/activity' },
    { icon: 'gift',            label: 'Refer a Friend', to: '/referral' },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.card} />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>{name ? `Hello, ${name}` : 'Hello'}</Text>
          <Text style={s.brand}>GO24 <Text style={s.brandSub}>FITNESS</Text></Text>
        </View>
        <Pressable style={s.bellWrap} onPress={() => router.push('/(tabs)/notifications')} hitSlop={8}>
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
          {unread > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Expiry alert */}
        {m && m.daysRemaining != null && m.daysRemaining <= 30 && (
          <Pressable style={s.alert} onPress={() => router.push('/payment/update-card')}>
            <Ionicons name={m.daysRemaining <= 0 ? 'alert-circle' : 'warning'} size={18} color={colors.primary} />
            <Text style={s.alertText}>
              {m.daysRemaining <= 0
                ? 'Membership expired — tap to renew'
                : `Membership expires in ${m.daysRemaining} days`}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        )}

        {/* Membership status card — tappable → /membership */}
        <Pressable style={s.memberCard} onPress={() => router.push('/membership')}>
          <View style={s.memberLeft}>
            <View style={s.memberIconBox}>
              <Ionicons name="card" size={16} color={colors.primary} />
            </View>
            <View>
              <Text style={s.memberClub}>{m?.planName?.toUpperCase() ?? 'MEMBERSHIP'}</Text>
              <Text style={s.memberStatus}>
                {m?.active ? '● Active' : '● Inactive'}
                {m?.daysRemaining != null ? `  ·  ${m.daysRemaining} days left` : ''}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.border} />
        </Pressable>

        {/* Next class hero */}
        <NextClassHero next={data?.nextClass ?? null} onBook={() => router.push('/(tabs)/classes')} />

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={[s.statNum, { color: (m?.daysRemaining ?? 99) < 30 ? colors.cta : colors.primary }]}>
              {m?.daysRemaining ?? '—'}
            </Text>
            <Text style={s.statLabel}>Days Left</Text>
          </View>
          <View style={[s.statCard, s.statCardMid]}>
            <Text style={s.statNum}>{pt?.remainingSessions ?? 0}</Text>
            <Text style={s.statLabel}>PT Sessions</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statNum, { color: colors.cta }]}>{data?.thisMonth.visits ?? 0}</Text>
            <Text style={s.statLabel}>This Month</Text>
          </View>
        </View>

        {/* Quick actions list */}
        <View style={s.actionsCard}>
          {ACTIONS.map((a, i) => (
            <Pressable
              key={a.label}
              style={[s.actionRow, i < ACTIONS.length - 1 && s.actionRowDivider]}
              onPress={() => router.push(a.to as any)}
            >
              <View style={s.actionIconCircle}>
                <Ionicons name={a.icon} size={18} color={colors.primary} />
              </View>
              <Text style={s.actionLabel}>{a.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.border} />
            </Pressable>
          ))}
        </View>

        {/* Banners */}
        {banners.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Promotions</Text>
            <FlatList
              data={banners}
              horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              keyExtractor={b => b.id}
              onMomentumScrollEnd={e => setBannerIdx(Math.round(e.nativeEvent.contentOffset.x / (W - 32)))}
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

        {/* Logout */}
        <Pressable style={s.logoutRow} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color={colors.textMuted} />
          <Text style={s.logoutText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07,
  shadowRadius: 8,
  elevation: 3,
} as const;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  greeting: { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted },
  brand:    { fontSize: 22, fontFamily: fonts.black, color: colors.primary, letterSpacing: 1 },
  brandSub: { fontSize: 14, fontFamily: fonts.bold,  color: colors.textMuted, letterSpacing: 2 },
  bellWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 3, right: 3,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.cta, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontFamily: fonts.black },

  scroll: { paddingTop: 12, paddingBottom: 40, gap: 12 },

  alert: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, backgroundColor: '#FFF5F5',
    borderLeftWidth: 3, borderLeftColor: colors.primary,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  alertText: { flex: 1, fontSize: 13, fontFamily: fonts.semibold, color: colors.primary },

  memberCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, backgroundColor: colors.card,
    borderRadius: 14, padding: 16, ...CARD_SHADOW,
  },
  memberLeft:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primary + '12',
    alignItems: 'center', justifyContent: 'center',
  },
  memberClub:   { fontSize: 13, fontFamily: fonts.bold, color: colors.primary, letterSpacing: 0.3 },
  memberStatus: { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 2 },

  emptyHero: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 16, backgroundColor: colors.card,
    borderRadius: 14, padding: 18, ...CARD_SHADOW,
  },
  emptyHeroIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.primary + '10',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyHeroTitle: { fontSize: 15, fontFamily: fonts.bold,    color: colors.text },
  emptyHeroSub:   { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 2 },
  emptyHeroBtn: {
    borderWidth: 1.5, borderColor: colors.cta, borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 7,
  },
  emptyHeroBtnText: { fontSize: 13, fontFamily: fonts.bold, color: colors.cta },

  heroCard:   { marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', ...CARD_SHADOW },
  heroInner:  { padding: 22, gap: 4 },
  heroEyebrow:{ fontSize: 10, fontFamily: fonts.bold, color: 'rgba(255,255,255,0.5)', letterSpacing: 2 },
  heroClassName:{ fontSize: 26, fontFamily: fonts.black, color: '#fff', marginTop: 2 },
  heroMeta:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  heroMetaItem:{ flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroMetaText:{ fontSize: 12, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.8)' },
  heroMetaDot: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  heroBadge: {
    alignSelf: 'flex-start', marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  heroBadgeText: { fontSize: 12, fontFamily: fonts.bold, color: '#fff' },

  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10 },
  statCard:  {
    flex: 1, backgroundColor: colors.card, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', gap: 4, ...CARD_SHADOW,
  },
  statCardMid: {
    borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border, borderRightColor: colors.border,
  },
  statNum:   { fontSize: 30, fontFamily: fonts.black, color: colors.primary },
  statLabel: { fontSize: 10, fontFamily: fonts.semibold, color: colors.textMuted, letterSpacing: 0.3 },

  actionsCard: {
    marginHorizontal: 16, backgroundColor: colors.card,
    borderRadius: 14, overflow: 'hidden', ...CARD_SHADOW,
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 15,
  },
  actionRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  actionIconCircle: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: colors.primary + '10',
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { flex: 1, fontSize: 15, fontFamily: fonts.regular, color: colors.text },

  sectionLabel: { fontSize: 13, fontFamily: fonts.semibold, color: colors.text, paddingHorizontal: 20 },

  banner:        { width: W - 32, height: 160, borderRadius: 16, overflow: 'hidden', marginHorizontal: 16 },
  bannerImg:     { width: '100%', height: '100%' },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end', padding: 14 },
  bannerTitle:   { color: '#fff', fontFamily: fonts.bold, fontSize: 15 },
  dots:          { flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot:           { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.border },
  dotActive:     { backgroundColor: colors.primary, width: 14 },

  logoutRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14,
  },
  logoutText: { fontSize: 14, fontFamily: fonts.regular, color: colors.textMuted },
});
