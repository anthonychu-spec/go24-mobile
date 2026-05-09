import { useEffect, useState, useCallback } from 'react';
import {
  Dimensions, FlatList, Image, Linking,
  Pressable, RefreshControl, ScrollView,
  StatusBar, StyleSheet, Text, View, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { apiClient } from '../../src/api/client';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';

const { width: W } = Dimensions.get('window');
const CELL_W = (W - 16 * 2 - 10) / 2;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Banner { id: string; title: string | null; imageUrl: string; linkUrl: string | null }
interface DashboardData {
  user: { name: string | null; email: string | null };
  membership: {
    active: boolean; planName: string | null;
    daysRemaining: number | null; expiresAt: string | null;
    outstandingBalance: number;
  };
  pt:        { remainingSessions: number; totalSessions: number; expiresAt: string | null };
  nextClass: { bookingId: string; classId: number; className?: string | null; startTime: string; minutesUntil: number; clubName: string | null } | null;
  thisMonth: { visits: number; classes: number; pt: number };
  unreadNotifications: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function getInitials(name: string | null) {
  if (!name) return 'G';
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (name[0] ?? 'G').toUpperCase();
}
function countdown(min: number) {
  if (min <= 0) return 'Now';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60), m = min % 60;
  return h < 24 ? `${h}h${m ? `${m}m` : ''}` : `${Math.floor(h / 24)}d`;
}
function fmtShortDate(iso: string | null) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-HK', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

// ─── Membership Card ─────────────────────────────────────────────────────────

function MemberCard({ m, name, onPress }: {
  m: DashboardData['membership'] | undefined;
  name: string;
  onPress: () => void;
}) {
  const days = m?.daysRemaining ?? null;
  const pct  = days != null ? Math.max(0, Math.min(1, days / 365)) : null;

  const cardContent = (
    <Pressable onPress={onPress} style={mc.inner}>
      {/* Decorative circles */}
      <View style={mc.circleA} />
      <View style={mc.circleB} />

      {/* Top row: logo + status */}
      <View style={mc.topRow}>
        <View style={mc.logoRow}>
          <View style={mc.logoIcon}>
            <Ionicons name="fitness" size={14} color="#fff" />
          </View>
          <Text style={mc.logoText}>GO24 FITNESS</Text>
        </View>
        <View style={[mc.chip, { backgroundColor: m?.active ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.12)' }]}>
          <View style={[mc.chipDot, { backgroundColor: m?.active ? '#4ADE80' : 'rgba(255,255,255,0.4)' }]} />
          <Text style={mc.chipText}>{m?.active ? 'Active' : 'Inactive'}</Text>
        </View>
      </View>

      {/* Name + plan */}
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Text style={mc.planLabel}>{m?.planName?.toUpperCase() ?? 'MEMBERSHIP'}</Text>
        <Text style={mc.memberName} numberOfLines={1}>{name || '—'}</Text>

        {/* Meta row */}
        <View style={mc.metaRow}>
          <Text style={mc.metaText}>
            {m?.expiresAt ? `Expires ${fmtShortDate(m.expiresAt)}` : 'Open-ended'}
          </Text>
          {days != null && days > 0 && (
            <Text style={mc.daysLeft}>{days} days left</Text>
          )}
          {days != null && days <= 0 && (
            <Text style={[mc.daysLeft, { color: '#FCA5A5' }]}>Expired</Text>
          )}
        </View>

        {/* Progress bar */}
        {pct != null && (
          <View style={mc.barTrack}>
            <View style={[mc.barFill, { width: `${pct * 100}%` as any }]} />
          </View>
        )}
      </View>
    </Pressable>
  );

  if (Platform.OS === 'web') {
    return <View style={[mc.card, { backgroundColor: colors.primary }]}>{cardContent}</View>;
  }
  return (
    <LinearGradient
      colors={[colors.primaryMid, colors.primaryDark]}
      start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
      style={mc.card}
    >
      {cardContent}
    </LinearGradient>
  );
}

const mc = StyleSheet.create({
  card: {
    marginHorizontal: 16, borderRadius: 24,
    height: 190, overflow: 'hidden',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 10,
  },
  inner:  { flex: 1, padding: 22 },

  // Decorative
  circleA: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.07)',
    top: -60, right: -40,
  },
  circleB: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: -40, left: 20,
  },

  topRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  logoIcon:{ width: 24, height: 24, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  logoText:{ fontSize: 12, fontFamily: fonts.black, color: '#fff', letterSpacing: 1.8 },
  chip:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText:{ fontSize: 11, fontFamily: fonts.semibold, color: '#fff' },

  planLabel:  { fontSize: 10, fontFamily: fonts.bold, color: 'rgba(255,255,255,0.55)', letterSpacing: 2, marginBottom: 4 },
  memberName: { fontSize: 24, fontFamily: fonts.black, color: '#fff', letterSpacing: 0.2 },
  metaRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  metaText:   { fontSize: 11, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.55)' },
  daysLeft:   { fontSize: 11, fontFamily: fonts.semibold, color: 'rgba(255,255,255,0.8)' },
  barTrack:   { height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  barFill:    { height: '100%', backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 3 },
});

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, tint, iconColor }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  value: string | number;
  label: string;
  tint: string;
  iconColor: string;
}) {
  return (
    <View style={st.card}>
      <View style={[st.iconWrap, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={[st.value, { color: iconColor }]}>{value}</Text>
      <Text style={st.label}>{label}</Text>
    </View>
  );
}
const st = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: colors.card, borderRadius: 18,
    paddingVertical: 16, alignItems: 'center', gap: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  value:    { fontSize: 24, fontFamily: fonts.black },
  label:    { fontSize: 9, fontFamily: fonts.semibold, color: colors.textMuted, letterSpacing: 0.5, textAlign: 'center' },
});

// ─── Action Grid Cell ─────────────────────────────────────────────────────────

function ActionCell({ icon, label, color, bg, onPress, badge }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  color: string;
  bg: string;
  onPress: () => void;
  badge?: boolean;
}) {
  return (
    <Pressable style={ac.cell} onPress={onPress}>
      <View style={[ac.iconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={24} color={color} />
        {badge && <View style={ac.badge} />}
      </View>
      <Text style={ac.label} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}
const ac = StyleSheet.create({
  cell: {
    width: CELL_W, backgroundColor: colors.card, borderRadius: 18,
    padding: 16, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  iconWrap: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  label:    { fontSize: 13, fontFamily: fonts.semibold, color: colors.text, lineHeight: 18 },
  badge:    {
    position: 'absolute', top: 2, right: 2,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.cta,
    borderWidth: 2, borderColor: colors.card,
  },
});

// ─── Next Class Card ──────────────────────────────────────────────────────────

function NextClassCard({ next, onBook }: {
  next: DashboardData['nextClass'] | null;
  onBook: () => void;
}) {
  if (!next) {
    return (
      <Pressable style={nx.empty} onPress={onBook}>
        <View style={nx.emptyIcon}>
          <Ionicons name="calendar-outline" size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={nx.emptyTitle}>No upcoming classes</Text>
          <Text style={nx.emptySub}>Tap to browse schedule</Text>
        </View>
        <View style={nx.bookBtn}>
          <Text style={nx.bookBtnText}>Book</Text>
        </View>
      </Pressable>
    );
  }

  const time = new Date(next.startTime).toLocaleTimeString('en-HK', { hour: '2-digit', minute: '2-digit', hour12: false });
  const date = new Date(next.startTime).toLocaleDateString('en-HK', { weekday: 'short', month: 'short', day: 'numeric' });

  const inner = (
    <View style={nx.heroInner}>
      <View style={nx.eyebrowRow}>
        <Text style={nx.eyebrow}>NEXT CLASS</Text>
        <View style={nx.timePill}>
          <Text style={nx.timePillText}>in {countdown(next.minutesUntil)}</Text>
        </View>
      </View>
      <Text style={nx.className} numberOfLines={2}>{next.className ?? `Class #${next.classId}`}</Text>
      <View style={nx.metaRow}>
        {[
          { icon: 'time-outline' as const, text: time },
          { icon: 'calendar-outline' as const, text: date },
          ...(next.clubName ? [{ icon: 'location-outline' as const, text: next.clubName }] : []),
        ].map((m, i) => (
          <View key={i} style={nx.metaItem}>
            <Ionicons name={m.icon} size={12} color="rgba(255,255,255,0.6)" />
            <Text style={nx.metaText}>{m.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  if (Platform.OS === 'web') {
    return <View style={[nx.hero, { backgroundColor: colors.primary }]}>{inner}</View>;
  }
  return (
    <LinearGradient colors={['#E8192C', '#820012']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={nx.hero}>
      {inner}
    </LinearGradient>
  );
}

const nx = StyleSheet.create({
  empty: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 16, backgroundColor: colors.card,
    borderRadius: 18, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  emptyIcon:  { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  emptySub:   { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 2 },
  bookBtn:    { borderWidth: 1.5, borderColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 7 },
  bookBtnText:{ fontSize: 13, fontFamily: fonts.bold, color: colors.primary },

  hero: {
    marginHorizontal: 16, borderRadius: 20, overflow: 'hidden',
    shadowColor: colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  heroInner:  { padding: 22 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  eyebrow:    { fontSize: 10, fontFamily: fonts.bold, color: 'rgba(255,255,255,0.5)', letterSpacing: 2 },
  timePill:   { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  timePillText:{ fontSize: 12, fontFamily: fonts.bold, color: '#fff' },
  className:  { fontSize: 22, fontFamily: fonts.black, color: '#fff', marginBottom: 12, lineHeight: 28 },
  metaRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:   { fontSize: 12, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.7)' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

const ACTIONS = [
  { icon: 'qr-code'             as const, label: 'QR\nCheck-in',     to: '/checkin/qr',        color: colors.primary,  bg: colors.primaryBg },
  { icon: 'calendar'            as const, label: 'Book a\nClass',    to: '/(tabs)/classes',    color: colors.blue,     bg: colors.blueBg    },
  { icon: 'bookmark'            as const, label: 'My\nBookings',     to: '/(tabs)/bookings',   color: colors.indigo,   bg: colors.indigoBg  },
  { icon: 'barbell'             as const, label: 'PT\nSessions',     to: '/(tabs)/pt',         color: colors.teal,     bg: colors.tealBg    },
  { icon: 'pulse'               as const, label: 'Activity\nLog',    to: '/(tabs)/activity',   color: colors.green,    bg: colors.greenBg   },
  { icon: 'gift'                as const, label: 'Refer a\nFriend',  to: '/referral',          color: colors.rose,     bg: colors.roseBg    },
  { icon: 'person-circle-outline' as const, label: 'My\nAccount',   to: '/profile',           color: colors.amber,    bg: colors.amberBg   },
];

export default function HomeScreen() {
  const router = useRouter();
  const [data, setData]       = useState<DashboardData | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [bannerIdx, setBannerIdx]   = useState(0);

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

  const name   = data?.user?.name ?? '';
  const m      = data?.membership;
  const pt     = data?.pt;
  const unread = data?.unreadNotifications ?? 0;
  const hasDebt = (m?.outstandingBalance ?? 0) > 0;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.card} />

      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable onPress={() => router.push('/profile')} hitSlop={8}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{getInitials(name)}</Text>
          </View>
        </Pressable>
        <View style={s.headerMid}>
          <Text style={s.greeting}>{getGreeting()}</Text>
          <Text style={s.headerName} numberOfLines={1}>{name || 'Welcome back'}</Text>
        </View>
        <Pressable
          style={s.bellBtn}
          onPress={() => router.push('/(tabs)/notifications')}
          hitSlop={8}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
          {unread > 0 && (
            <View style={s.notifDot}>
              <Text style={s.notifDotText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* ── Scroll Content ── */}
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >

        {/* Membership card */}
        <MemberCard m={m} name={name} onPress={() => router.push('/profile')} />

        {/* Outstanding balance */}
        {hasDebt && (
          <Pressable style={s.debtBanner} onPress={() => router.push('/profile')}>
            <Ionicons name="alert-circle" size={18} color="#fff" />
            <Text style={s.debtText}>
              Outstanding HK${m!.outstandingBalance.toLocaleString('en-HK', { minimumFractionDigits: 2 })} — tap to pay
            </Text>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.6)" />
          </Pressable>
        )}

        {/* Expiry alert */}
        {!hasDebt && m && m.daysRemaining != null && m.daysRemaining <= 30 && (
          <View style={[s.debtBanner, { backgroundColor: m.daysRemaining <= 0 ? colors.error : colors.warning }]}>
            <Ionicons name={m.daysRemaining <= 0 ? 'alert-circle' : 'warning'} size={18} color="#fff" />
            <Text style={s.debtText}>
              {m.daysRemaining <= 0 ? 'Membership expired' : `Expires in ${m.daysRemaining} days`}
            </Text>
          </View>
        )}

        {/* Stats row */}
        <View style={s.statsRow}>
          <StatCard
            icon="calendar-outline"
            value={m?.daysRemaining ?? '—'}
            label="DAYS LEFT"
            tint={colors.primaryBg}
            iconColor={colors.primary}
          />
          <StatCard
            icon="barbell-outline"
            value={pt?.remainingSessions ?? 0}
            label="PT SESSIONS"
            tint={colors.tealBg}
            iconColor={colors.teal}
          />
          <StatCard
            icon="flame-outline"
            value={data?.thisMonth.visits ?? 0}
            label="THIS MONTH"
            tint={colors.amberBg}
            iconColor={colors.amber}
          />
        </View>

        {/* Next class */}
        <NextClassCard next={data?.nextClass ?? null} onBook={() => router.push('/(tabs)/classes')} />

        {/* Actions grid */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>Quick Actions</Text>
        </View>
        <View style={s.grid}>
          {ACTIONS.map(a => (
            <ActionCell
              key={a.label}
              icon={a.icon}
              label={a.label}
              color={a.color}
              bg={a.bg}
              badge={a.to === '/profile' && hasDebt}
              onPress={() => router.push(a.to as any)}
            />
          ))}
        </View>

        {/* Banners */}
        {banners.length > 0 && (
          <>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>Promotions</Text>
            </View>
            <FlatList
              data={banners}
              horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              keyExtractor={b => b.id}
              onMomentumScrollEnd={e =>
                setBannerIdx(Math.round(e.nativeEvent.contentOffset.x / (W - 32)))
              }
              renderItem={({ item }) => (
                <Pressable
                  style={s.banner}
                  onPress={() => item.linkUrl && Linking.openURL(item.linkUrl)}
                >
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
                {banners.map((_, i) => (
                  <View key={i} style={[s.dot, i === bannerIdx && s.dotActive]} />
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingTop: 16, paddingBottom: 32, gap: 12 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  avatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontSize: 15, fontFamily: fonts.black, color: '#fff' },
  headerMid:   { flex: 1 },
  greeting:    { fontSize: 11, fontFamily: fonts.regular, color: colors.textMuted },
  headerName:  { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  bellBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  notifDot: {
    position: 'absolute', top: 4, right: 4,
    minWidth: 15, height: 15, borderRadius: 8,
    backgroundColor: colors.cta,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  notifDotText: { color: '#fff', fontSize: 8, fontFamily: fonts.black },

  // Debt / expiry banner
  debtBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, backgroundColor: colors.primary,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
  },
  debtText: { flex: 1, fontSize: 13, fontFamily: fonts.semibold, color: '#fff' },

  // Stats
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10 },

  // Section header
  sectionRow:  { paddingHorizontal: 16, marginBottom: -4 },
  sectionTitle:{ fontSize: 16, fontFamily: fonts.bold, color: colors.text },

  // Grid
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 10,
  },

  // Banners
  banner:        { width: W - 32, height: 170, borderRadius: 18, overflow: 'hidden', marginHorizontal: 16 },
  bannerImg:     { width: '100%', height: '100%' },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)', justifyContent: 'flex-end', padding: 16 },
  bannerTitle:   { color: '#fff', fontFamily: fonts.bold, fontSize: 15 },
  dots:          { flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot:           { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.border },
  dotActive:     { backgroundColor: colors.primary, width: 14 },
});
