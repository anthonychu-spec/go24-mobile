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
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
function getInitials(n: string | null) {
  if (!n) return 'G';
  const p = n.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : (n[0]??'G').toUpperCase();
}
function countdown(min: number) {
  if (min <= 0) return 'Now';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min/60), m = min%60;
  return h < 24 ? `${h}h${m?`${m}m`:''}` : `${Math.floor(h/24)}d`;
}
function fmtDate(iso: string|null) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'}); }
  catch { return '—'; }
}

// ─── Quick Actions data ───────────────────────────────────────────────────────

const ACTIONS = [
  { icon: 'qr-code'               as const, label: 'QR Check-in',   to: '/checkin/qr',        color: '#fff',    bg: 'rgba(255,255,255,0.22)', featured: true },
  { icon: 'calendar'              as const, label: 'Book Class',     to: '/(tabs)/classes',    color: colors.blue,    bg: colors.blueBg    },
  { icon: 'bookmark'              as const, label: 'My Bookings',    to: '/(tabs)/bookings',   color: colors.indigo,  bg: colors.indigoBg  },
  { icon: 'barbell'               as const, label: 'PT Sessions',    to: '/(tabs)/pt',         color: colors.teal,    bg: colors.tealBg    },
  { icon: 'pulse'                 as const, label: 'Activity',       to: '/(tabs)/activity',   color: colors.green,   bg: colors.greenBg   },
  { icon: 'gift'                  as const, label: 'Refer Friend',   to: '/referral',          color: colors.rose,    bg: colors.roseBg    },
  { icon: 'person-circle-outline' as const, label: 'My Account',    to: '/profile',           color: colors.amber,   bg: colors.amberBg   },
];

// ─── Next Class Card ──────────────────────────────────────────────────────────

function NextClassCard({ next, onBook }: { next: DashboardData['nextClass']|null; onBook: ()=>void }) {
  if (!next) return (
    <Pressable style={nx.empty} onPress={onBook}>
      <View style={nx.emptyLeft}>
        <Text style={nx.emptyTitle}>No upcoming classes</Text>
        <Text style={nx.emptySub}>Browse and book your next session</Text>
      </View>
      <View style={nx.emptyBtn}>
        <Text style={nx.emptyBtnText}>Book →</Text>
      </View>
    </Pressable>
  );

  const time = new Date(next.startTime).toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit',hour12:false});
  const date = new Date(next.startTime).toLocaleDateString('en-HK',{weekday:'short',month:'short',day:'numeric'});

  const inner = (
    <View style={nx.inner}>
      <View style={nx.topRow}>
        <Text style={nx.eyebrow}>NEXT CLASS</Text>
        <View style={nx.badge}><Text style={nx.badgeText}>in {countdown(next.minutesUntil)}</Text></View>
      </View>
      <Text style={nx.name} numberOfLines={2}>{next.className ?? `Class #${next.classId}`}</Text>
      <View style={nx.meta}>
        <Text style={nx.metaText}>{time}  ·  {date}{next.clubName ? `  ·  ${next.clubName}` : ''}</Text>
      </View>
    </View>
  );

  if (Platform.OS === 'web') return <View style={[nx.card,{backgroundColor:'#1a1a2e'}]}>{inner}</View>;
  return (
    <LinearGradient colors={['#1a1a2e','#16213e']} start={{x:0,y:0}} end={{x:1,y:1}} style={nx.card}>
      {inner}
    </LinearGradient>
  );
}

const nx = StyleSheet.create({
  empty: {
    flexDirection:'row', alignItems:'center',
    marginHorizontal:16, padding:20,
    backgroundColor:colors.card, borderRadius:20,
    borderWidth:1.5, borderColor:colors.border,
  },
  emptyLeft: { flex:1 },
  emptyTitle:{ fontSize:15, fontFamily:fonts.bold, color:colors.text },
  emptySub:  { fontSize:12, fontFamily:fonts.regular, color:colors.textMuted, marginTop:3 },
  emptyBtn:  { paddingHorizontal:16, paddingVertical:8, backgroundColor:colors.primaryBg, borderRadius:10 },
  emptyBtnText:{ fontSize:13, fontFamily:fonts.bold, color:colors.primary },

  card:  { marginHorizontal:16, borderRadius:20, overflow:'hidden' },
  inner: { padding:22 },
  topRow:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:10 },
  eyebrow:{ fontSize:10, fontFamily:fonts.bold, color:'rgba(255,255,255,0.4)', letterSpacing:2 },
  badge: { backgroundColor:'rgba(255,255,255,0.1)', paddingHorizontal:12, paddingVertical:5, borderRadius:20 },
  badgeText:{ fontSize:12, fontFamily:fonts.bold, color:'#fff' },
  name:  { fontSize:24, fontFamily:fonts.black, color:'#fff', lineHeight:30, marginBottom:12 },
  meta:  {},
  metaText:{ fontSize:12, fontFamily:fonts.regular, color:'rgba(255,255,255,0.5)' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const [data, setData]       = useState<DashboardData|null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [bannerIdx, setBannerIdx]   = useState(0);

  const load = useCallback(async (isRefresh=false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [d,b] = await Promise.allSettled([
        apiClient.get<DashboardData>('/me/dashboard'),
        apiClient.get<Banner[]>('/banners'),
      ]);
      if (d.status==='fulfilled') setData(d.value.data);
      if (b.status==='fulfilled') setBanners(b.value.data);
    } finally { setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const name    = data?.user?.name ?? '';
  const m       = data?.membership;
  const pt      = data?.pt;
  const unread  = data?.unreadNotifications ?? 0;
  const hasDebt = (m?.outstandingBalance ?? 0) > 0;
  const days    = m?.daysRemaining ?? null;
  const pct     = days != null ? Math.max(0, Math.min(1, days/365)) : null;

  const heroContent = (
    <>
      {/* ── Header row ── */}
      <View style={s.header}>
        <Pressable onPress={() => router.push('/profile')} hitSlop={10}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{getInitials(name)}</Text>
          </View>
        </Pressable>
        <View style={s.headerMid}>
          <Text style={s.greeting}>{getGreeting()}</Text>
          <Text style={s.heroName} numberOfLines={1}>{name || 'Welcome back'}</Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/notifications')} hitSlop={10} style={s.bellBtn}>
          <Ionicons name="notifications-outline" size={22} color="rgba(255,255,255,0.9)" />
          {unread > 0 && (
            <View style={s.badge}><Text style={s.badgeText}>{unread > 9 ? '9+' : unread}</Text></View>
          )}
        </Pressable>
      </View>

      {/* ── Membership info on hero ── */}
      <Pressable style={s.memberSection} onPress={() => router.push('/profile')}>
        {/* Plan + status */}
        <View style={s.planRow}>
          <Text style={s.planLabel}>{m?.planName?.toUpperCase() ?? 'MEMBERSHIP'}</Text>
          <View style={[s.statusChip, { backgroundColor: m?.active ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.12)' }]}>
            <View style={[s.statusDot, { backgroundColor: m?.active ? '#4ADE80' : 'rgba(255,255,255,0.4)' }]} />
            <Text style={s.statusText}>{m?.active ? 'Active' : 'Inactive'}</Text>
          </View>
        </View>

        {/* Days remaining — big hero number */}
        <View style={s.daysRow}>
          <Text style={s.daysNum}>{days ?? '—'}</Text>
          <View style={s.daysMeta}>
            <Text style={s.daysUnit}>days</Text>
            <Text style={s.daysUnit}>remaining</Text>
          </View>
        </View>

        {/* Expiry + progress */}
        {m?.expiresAt && <Text style={s.expiryText}>Expires {fmtDate(m.expiresAt)}</Text>}
        {pct != null && (
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${pct*100}%` as any }]} />
          </View>
        )}
      </Pressable>
    </>
  );

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* ── Red hero zone (header + membership) ── */}
      {Platform.OS === 'web'
        ? <View style={[s.heroZone, { backgroundColor: colors.primary }]}>{heroContent}</View>
        : (
          <LinearGradient colors={[colors.primaryMid, colors.primaryDark]} start={{x:0,y:0}} end={{x:0.6,y:1}} style={s.heroZone}>
            {heroContent}
          </LinearGradient>
        )
      }

      {/* ── Scrollable content (white bg) ── */}
      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Alerts */}
        {hasDebt && (
          <Pressable style={s.alertBanner} onPress={() => router.push('/profile')}>
            <Ionicons name="alert-circle" size={16} color={colors.primary} />
            <Text style={s.alertText}>
              Outstanding HK${m!.outstandingBalance.toLocaleString('en-HK',{minimumFractionDigits:2})} — tap to pay now
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        )}
        {!hasDebt && m && days != null && days <= 30 && (
          <View style={[s.alertBanner, { borderColor: days<=0 ? colors.error : colors.warning, backgroundColor: days<=0 ? '#FFF5F5' : '#FFFBF0' }]}>
            <Ionicons name={days<=0 ? 'alert-circle' : 'warning'} size={16} color={days<=0 ? colors.error : colors.warning} />
            <Text style={[s.alertText, { color: days<=0 ? colors.error : colors.amber }]}>
              {days<=0 ? 'Membership expired — please renew' : `Membership expires in ${days} days`}
            </Text>
          </View>
        )}

        {/* ── Stats ── */}
        <View style={s.statsRow}>
          {[
            { label:'Days Left',    value: days ?? '—',                   color: colors.primary },
            { label:'PT Sessions',  value: pt?.remainingSessions ?? 0,    color: colors.teal    },
            { label:'This Month',   value: data?.thisMonth.visits ?? 0,   color: colors.amber   },
          ].map((stat, i) => (
            <View key={stat.label} style={[s.statItem, i>0 && s.statItemBorder]}>
              <Text style={[s.statNum, { color: stat.color }]}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Next class ── */}
        <NextClassCard next={data?.nextClass ?? null} onBook={() => router.push('/(tabs)/classes')} />

        {/* ── Quick Actions ── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Quick Actions</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.actionsScroll}
        >
          {ACTIONS.map(a => (
            <Pressable
              key={a.label}
              style={[
                s.actionItem,
                a.featured && s.actionItemFeatured,
              ]}
              onPress={() => router.push(a.to as any)}
            >
              <View style={[s.actionIcon, { backgroundColor: a.bg }]}>
                <Ionicons name={a.icon} size={22} color={a.color} />
                {a.to==='/profile' && hasDebt && <View style={s.actionDot} />}
              </View>
              <Text style={[s.actionLabel, a.featured && s.actionLabelFeatured]}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Banners ── */}
        {banners.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Promotions</Text>
            </View>
            <FlatList
              data={banners}
              horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              keyExtractor={b => b.id}
              onMomentumScrollEnd={e => setBannerIdx(Math.round(e.nativeEvent.contentOffset.x/(W-32)))}
              renderItem={({ item }) => (
                <Pressable style={s.banner} onPress={() => item.linkUrl && Linking.openURL(item.linkUrl)}>
                  <Image source={{ uri: item.imageUrl }} style={s.bannerImg} resizeMode="cover" />
                  {item.title && (
                    <View style={s.bannerOverlay}><Text style={s.bannerTitle}>{item.title}</Text></View>
                  )}
                </Pressable>
              )}
            />
            {banners.length > 1 && (
              <View style={s.dots}>
                {banners.map((_,i) => <View key={i} style={[s.dot, i===bannerIdx && s.dotActive]} />)}
              </View>
            )}
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },

  // Hero zone
  heroZone: {
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },

  // Header
  header: {
    flexDirection:'row', alignItems:'center', gap:12,
    paddingHorizontal:20, paddingTop:8, paddingBottom:4,
  },
  avatar:     { width:40, height:40, borderRadius:20, backgroundColor:'rgba(255,255,255,0.22)', alignItems:'center', justifyContent:'center' },
  avatarText: { fontSize:15, fontFamily:fonts.black, color:'#fff' },
  headerMid:  { flex:1 },
  greeting:   { fontSize:11, fontFamily:fonts.regular, color:'rgba(255,255,255,0.6)' },
  heroName:   { fontSize:17, fontFamily:fonts.bold, color:'#fff' },
  bellBtn:    { width:40, height:40, alignItems:'center', justifyContent:'center' },
  badge: {
    position:'absolute', top:4, right:4,
    minWidth:15, height:15, borderRadius:8,
    backgroundColor:colors.cta,
    alignItems:'center', justifyContent:'center', paddingHorizontal:3,
  },
  badgeText: { color:'#fff', fontSize:8, fontFamily:fonts.black },

  // Membership section on hero
  memberSection: { paddingHorizontal:20, paddingTop:20, gap:6 },
  planRow:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  planLabel:  { fontSize:11, fontFamily:fonts.bold, color:'rgba(255,255,255,0.5)', letterSpacing:2 },
  statusChip: { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:10, paddingVertical:4, borderRadius:20 },
  statusDot:  { width:6, height:6, borderRadius:3 },
  statusText: { fontSize:11, fontFamily:fonts.semibold, color:'#fff' },
  daysRow:    { flexDirection:'row', alignItems:'flex-end', gap:10, marginTop:4 },
  daysNum:    { fontSize:64, fontFamily:fonts.black, color:'#fff', lineHeight:68 },
  daysMeta:   { paddingBottom:10 },
  daysUnit:   { fontSize:14, fontFamily:fonts.semibold, color:'rgba(255,255,255,0.6)', lineHeight:20 },
  expiryText: { fontSize:12, fontFamily:fonts.regular, color:'rgba(255,255,255,0.45)', marginTop:2 },
  progressTrack: { height:3, backgroundColor:'rgba(255,255,255,0.15)', borderRadius:3, marginTop:14, overflow:'hidden' },
  progressFill:  { height:'100%', backgroundColor:'rgba(255,255,255,0.6)', borderRadius:3 },

  // Scroll
  scrollView:    { flex:1, backgroundColor:colors.bg },
  scrollContent: { paddingTop:16, paddingBottom:32, gap:14 },

  // Alert banner
  alertBanner: {
    flexDirection:'row', alignItems:'center', gap:8,
    marginHorizontal:16, backgroundColor:colors.primaryBg,
    borderWidth:1, borderColor: colors.primary + '30',
    borderRadius:14, paddingHorizontal:14, paddingVertical:12,
  },
  alertText: { flex:1, fontSize:13, fontFamily:fonts.semibold, color:colors.primary },

  // Stats
  statsRow: {
    flexDirection:'row',
    marginHorizontal:16, backgroundColor:colors.card,
    borderRadius:20, paddingVertical:18,
    shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:8, elevation:2,
  },
  statItem: { flex:1, alignItems:'center', gap:3 },
  statItemBorder: { borderLeftWidth:StyleSheet.hairlineWidth, borderLeftColor:colors.border },
  statNum:   { fontSize:30, fontFamily:fonts.black },
  statLabel: { fontSize:10, fontFamily:fonts.semibold, color:colors.textMuted, letterSpacing:0.5 },

  // Section header
  sectionHeader: { paddingHorizontal:20 },
  sectionTitle:  { fontSize:18, fontFamily:fonts.black, color:colors.text },

  // Horizontal actions
  actionsScroll: { paddingHorizontal:16, gap:10 },
  actionItem: {
    alignItems:'center', gap:8,
    backgroundColor:colors.card,
    borderRadius:18, padding:14, width:86,
    shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:6, elevation:2,
  },
  actionItemFeatured: {
    backgroundColor:colors.primary,
  },
  actionIcon: {
    width:46, height:46, borderRadius:14,
    alignItems:'center', justifyContent:'center',
  },
  actionLabel: {
    fontSize:11, fontFamily:fonts.semibold, color:colors.text,
    textAlign:'center', lineHeight:15,
  },
  actionLabelFeatured: { color:'#fff' },
  actionDot: {
    position:'absolute', top:2, right:2,
    width:9, height:9, borderRadius:5,
    backgroundColor:colors.cta,
    borderWidth:2, borderColor:colors.card,
  },

  // Banners
  banner:        { width:W-32, height:170, borderRadius:18, overflow:'hidden', marginHorizontal:16 },
  bannerImg:     { width:'100%', height:'100%' },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.28)', justifyContent:'flex-end', padding:16 },
  bannerTitle:   { color:'#fff', fontFamily:fonts.bold, fontSize:15 },
  dots:          { flexDirection:'row', justifyContent:'center', gap:5 },
  dot:           { width:5, height:5, borderRadius:3, backgroundColor:colors.border },
  dotActive:     { backgroundColor:colors.primary, width:14 },
});
