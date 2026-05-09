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
const CELL = (W - 16 * 2 - 10) / 2;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Banner { id: string; title: string | null; imageUrl: string; linkUrl: string | null }
interface DashboardData {
  user: { name: string | null; email: string | null; memberCode: string | null };
  savedCardExpired: boolean;
  membership: {
    active: boolean; planName: string | null;
    daysRemaining: number | null; expiresAt: string | null;
    outstandingBalance: number;
  };
  pt:        { remainingSessions: number; totalSessions: number; expiresAt: string | null };
  nextClass: { bookingId: string; classId: number; className?: string | null; startTime: string; minutesUntil: number; clubName: string | null } | null;
  thisMonth: { visits: number; classes: number; pt: number };
  totalVisits: number;
  unreadNotifications: number;
  streak: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
function initials(n: string | null) {
  if (!n) return 'G';
  const p = n.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : (n[0]??'G').toUpperCase();
}
function eta(min: number) {
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

// ─── Membership Card ──────────────────────────────────────────────────────────

function MemberCard({ m, pt, name, memberCode, onPress }: {
  m: DashboardData['membership']|undefined;
  pt: DashboardData['pt']|undefined;
  name: string;
  memberCode: string | null;
  onPress: ()=>void;
}) {
  const days = m?.daysRemaining ?? null;
  const pct  = days != null ? Math.max(0, Math.min(1, days/365)) : null;

  const body = (
    <Pressable onPress={onPress} style={mc.body}>
      {/* decorative circles */}
      <View style={mc.c1} /><View style={mc.c2} />

      {/* top */}
      <View style={mc.top}>
        <View style={mc.brandRow}>
          <Ionicons name="fitness" size={13} color="rgba(255,255,255,0.7)" />
          <Text style={mc.brand}>GO24 FITNESS</Text>
        </View>
        <View style={[mc.pill, { backgroundColor: m?.active ? 'rgba(74,222,128,0.22)' : 'rgba(255,255,255,0.12)' }]}>
          <View style={[mc.dot, { backgroundColor: m?.active ? '#4ADE80' : 'rgba(255,255,255,0.4)' }]} />
          <Text style={mc.pillTxt}>{m?.active ? 'Active' : 'Inactive'}</Text>
        </View>
      </View>

      {/* centre — plan name + member name */}
      <View style={mc.centre}>
        <Text style={mc.plan}>{m?.planName?.toUpperCase() ?? 'MEMBERSHIP'}</Text>
        <Text style={mc.memberName} numberOfLines={1}>{name || '—'}</Text>
        {memberCode && <Text style={mc.memberCode}>#{memberCode}</Text>}
      </View>

      {/* bottom — expiry, days remaining, PT sessions */}
      <View style={mc.bottom}>
        <View>
          <Text style={mc.metaLabel}>EXPIRES</Text>
          <Text style={mc.metaVal}>{fmtDate(m?.expiresAt ?? null)}</Text>
        </View>
        {(pt?.remainingSessions ?? 0) > 0 && (
          <View style={{ alignItems: 'center' }}>
            <Text style={mc.metaLabel}>PT LEFT</Text>
            <Text style={mc.metaVal}>{pt!.remainingSessions} sessions</Text>
          </View>
        )}
        {days != null && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={mc.metaLabel}>REMAINING</Text>
            <Text style={mc.metaVal}>{days > 0 ? `${days} days` : 'Expired'}</Text>
          </View>
        )}
      </View>

      {pct != null && (
        <View style={mc.bar}><View style={[mc.fill, { width: `${pct*100}%` as any }]} /></View>
      )}
    </Pressable>
  );

  if (Platform.OS === 'web')
    return <View style={[mc.card,{backgroundColor:colors.primaryMid}]}>{body}</View>;
  return (
    <LinearGradient colors={[colors.primaryMid, colors.primaryDark]}
      start={{x:0.1,y:0}} end={{x:0.9,y:1}} style={mc.card}>{body}
    </LinearGradient>
  );
}

const mc = StyleSheet.create({
  card:  { marginHorizontal:16, borderRadius:24, height:200, overflow:'hidden',
            shadowColor:colors.primaryDark, shadowOffset:{width:0,height:8}, shadowOpacity:0.35, shadowRadius:18, elevation:10 },
  body:  { flex:1, padding:22, justifyContent:'space-between' },
  c1:    { position:'absolute', width:200, height:200, borderRadius:100, backgroundColor:'rgba(255,255,255,0.06)', top:-70, right:-50 },
  c2:    { position:'absolute', width:130, height:130, borderRadius:65,  backgroundColor:'rgba(255,255,255,0.04)', bottom:-50, left:10 },
  top:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  brandRow:{ flexDirection:'row', alignItems:'center', gap:6 },
  brand: { fontSize:11, fontFamily:fonts.black, color:'rgba(255,255,255,0.7)', letterSpacing:2 },
  pill:  { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:10, paddingVertical:4, borderRadius:20 },
  dot:   { width:6, height:6, borderRadius:3 },
  pillTxt:{ fontSize:11, fontFamily:fonts.semibold, color:'#fff' },
  centre:{ gap:2 },
  plan:  { fontSize:10, fontFamily:fonts.semibold, color:'rgba(255,255,255,0.5)', letterSpacing:2 },
  memberName: { fontSize:26, fontFamily:fonts.black, color:'#fff' },
  memberCode: { fontSize:11, fontFamily:fonts.regular, color:'rgba(255,255,255,0.5)', letterSpacing:1, marginTop:1 },
  bottom:{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-end' },
  metaLabel:{ fontSize:9, fontFamily:fonts.semibold, color:'rgba(255,255,255,0.4)', letterSpacing:1.5, marginBottom:2 },
  metaVal:  { fontSize:13, fontFamily:fonts.bold, color:'rgba(255,255,255,0.85)' },
  bar:   { height:3, backgroundColor:'rgba(255,255,255,0.15)', borderRadius:3, marginTop:10, overflow:'hidden' },
  fill:  { height:'100%', backgroundColor:'rgba(255,255,255,0.55)', borderRadius:3 },
});

// ─── Stat Card (inline) ───────────────────────────────────────────────────────

function StatRow({ visits, pt, classes }: { visits:number; pt:number; classes:number }) {
  const items = [
    { label:'Visits',   val: visits,  color:colors.primary, icon:'walk-outline'    as const },
    { label:'PT',       val: pt,      color:colors.teal,    icon:'barbell-outline' as const },
    { label:'Classes',  val: classes, color:colors.indigo,  icon:'people-outline'  as const },
  ];
  return (
    <View style={sr.outer}>
      <Text style={sr.period}>THIS MONTH</Text>
      <View style={sr.wrap}>
        {items.map((it, i) => (
          <View key={it.label} style={[sr.item, i>0 && sr.border]}>
            <View style={[sr.iconBox, { backgroundColor: it.color + '15' }]}>
              <Ionicons name={it.icon} size={15} color={it.color} />
            </View>
            <Text style={[sr.num, { color:it.color }]}>{it.val}</Text>
            <Text style={sr.lbl}>{it.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
const sr = StyleSheet.create({
  outer:   { marginHorizontal:16, gap:8 },
  period:  { fontSize:10, fontFamily:fonts.bold, color:colors.textMuted, letterSpacing:1.5 },
  wrap:    { flexDirection:'row', backgroundColor:colors.card,
              borderRadius:20, paddingVertical:18,
              shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  item:    { flex:1, alignItems:'center', gap:5 },
  border:  { borderLeftWidth:StyleSheet.hairlineWidth, borderLeftColor:colors.border },
  iconBox: { width:32, height:32, borderRadius:9, alignItems:'center', justifyContent:'center' },
  num:     { fontSize:26, fontFamily:fonts.black },
  lbl:     { fontSize:9, fontFamily:fonts.bold, color:colors.textMuted, letterSpacing:0.6, textAlign:'center' },
});

// ─── Next Class Card ──────────────────────────────────────────────────────────

function NextCard({ next, onBook }: { next:DashboardData['nextClass']|null; onBook:()=>void }) {
  if (!next) return (
    <Pressable style={nc.empty} onPress={onBook}>
      <View style={nc.emptyIcon}>
        <Ionicons name="calendar-outline" size={22} color={colors.primary} />
      </View>
      <View style={{flex:1}}>
        <Text style={nc.emptyTitle}>No upcoming classes</Text>
        <Text style={nc.emptySub}>Browse the schedule and book</Text>
      </View>
      <View style={nc.emptyBtn}><Text style={nc.emptyBtnTxt}>Book</Text></View>
    </Pressable>
  );

  const time = new Date(next.startTime).toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit',hour12:false});
  const date = new Date(next.startTime).toLocaleDateString('en-HK',{weekday:'short',month:'short',day:'numeric'});

  return (
    <View style={nc.card}>
      {/* Red accent stripe */}
      <View style={nc.stripe} />
      <View style={nc.inner}>
        <View style={nc.topRow}>
          <Text style={nc.eyebrow}>NEXT CLASS</Text>
          <View style={nc.timeBadge}>
            <Ionicons name="time-outline" size={11} color={colors.primary} />
            <Text style={nc.timeBadgeTxt}>in {eta(next.minutesUntil)}</Text>
          </View>
        </View>
        <Text style={nc.name} numberOfLines={2}>{next.className ?? `Class #${next.classId}`}</Text>
        <View style={nc.meta}>
          {[
            { icon:'time-outline' as const, txt: time },
            { icon:'calendar-outline' as const, txt: date },
            ...(next.clubName ? [{icon:'location-outline' as const, txt:next.clubName}] : []),
          ].map((m,i)=>(
            <View key={i} style={nc.metaItem}>
              <Ionicons name={m.icon} size={12} color={colors.textMuted} />
              <Text style={nc.metaTxt}>{m.txt}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
const nc = StyleSheet.create({
  empty:       { flexDirection:'row', alignItems:'center', gap:14, marginHorizontal:16,
                  backgroundColor:colors.card, borderRadius:20, padding:18,
                  shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  emptyIcon:   { width:46, height:46, borderRadius:13, backgroundColor:colors.primaryBg, alignItems:'center', justifyContent:'center' },
  emptyTitle:  { fontSize:15, fontFamily:fonts.bold, color:colors.text },
  emptySub:    { fontSize:12, fontFamily:fonts.regular, color:colors.textMuted, marginTop:2 },
  emptyBtn:    { paddingHorizontal:14, paddingVertical:7, backgroundColor:colors.primaryBg, borderRadius:10 },
  emptyBtnTxt: { fontSize:13, fontFamily:fonts.bold, color:colors.primary },

  card:  { flexDirection:'row', marginHorizontal:16, backgroundColor:colors.card, borderRadius:20, overflow:'hidden',
            shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  stripe:{ width:4, backgroundColor:colors.primary },
  inner: { flex:1, padding:18 },
  topRow:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:8 },
  eyebrow:{ fontSize:10, fontFamily:fonts.bold, color:colors.textMuted, letterSpacing:2 },
  timeBadge: { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:colors.primaryBg, paddingHorizontal:10, paddingVertical:4, borderRadius:20 },
  timeBadgeTxt:{ fontSize:11, fontFamily:fonts.semibold, color:colors.primary },
  name:  { fontSize:20, fontFamily:fonts.black, color:colors.text, lineHeight:26, marginBottom:12 },
  meta:  { gap:5 },
  metaItem:{ flexDirection:'row', alignItems:'center', gap:5 },
  metaTxt: { fontSize:12, fontFamily:fonts.regular, color:colors.textMuted },
});

// ─── Action Grid Cell ─────────────────────────────────────────────────────────

function ActionCell({ icon, label, color, bg, to, badge }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string; color: string; bg: string; to: string; badge?: boolean;
}) {
  const router = useRouter();
  return (
    <Pressable style={ag.cell} onPress={() => router.push(to as any)}>
      <View style={[ag.icon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={24} color={color} />
        {badge && <View style={ag.dot} />}
      </View>
      <Text style={ag.label}>{label}</Text>
    </Pressable>
  );
}
const ag = StyleSheet.create({
  cell:  { width:CELL, backgroundColor:colors.card, borderRadius:20, padding:16, gap:10,
            shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  icon:  { width:50, height:50, borderRadius:15, alignItems:'center', justifyContent:'center' },
  label: { fontSize:13, fontFamily:fonts.semibold, color:colors.text, lineHeight:18 },
  dot:   { position:'absolute', top:2, right:2, width:10, height:10, borderRadius:5,
            backgroundColor:colors.cta, borderWidth:2, borderColor:colors.card },
});

// ─── Actions data ─────────────────────────────────────────────────────────────

const ACTIONS = [
  { icon:'calendar' as const, label:'Book a Class', to:'/(tabs)/classes',  color:colors.blue,   bg:colors.blueBg   },
  { icon:'bookmark' as const, label:'My Bookings',  to:'/(tabs)/bookings', color:colors.indigo, bg:colors.indigoBg },
  { icon:'barbell'  as const, label:'PT Sessions',  to:'/(tabs)/pt',       color:colors.teal,   bg:colors.tealBg   },
  { icon:'pulse'    as const, label:'Activity Log', to:'/(tabs)/activity', color:colors.green,  bg:colors.greenBg  },
];

// ─── 互動 HUB ─────────────────────────────────────────────────────────────────

const MILESTONES = [10, 50, 100, 200];

interface HintCard {
  key: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  iconBg: string;
  title: string;
  body: string;
  action?: string;
  onPress?: () => void;
}

function buildHints(args: {
  totalVisits: number;
  streak: number;
  ptRemaining: number;
  monthClasses: number;
  monthVisits: number;
  daysRemaining: number | null;
  hasDebt: boolean;
  hasExpired: boolean;
  cardExpired: boolean;
  onPay: () => void;
  onProfile: () => void;
  onPT: () => void;
  onClasses: () => void;
}): HintCard[] {
  const cards: HintCard[] = [];
  const { totalVisits, streak, ptRemaining, monthClasses, monthVisits,
          daysRemaining, hasDebt, hasExpired, cardExpired } = args;

  // ── Urgent first ──
  if (cardExpired) {
    cards.push({
      key: 'card-expired',
      icon: 'card', iconColor: colors.primary, iconBg: colors.primaryBg,
      title: '信用卡已過期',
      body: '你的儲存信用卡已過期，自動付款及 App 付款將無法進行，請更新卡資料。',
      action: '更新信用卡', onPress: args.onProfile,
    });
  }
  if (hasDebt) {
    cards.push({
      key: 'debt',
      icon: 'alert-circle', iconColor: colors.primary, iconBg: colors.primaryBg,
      title: '入唔到場？立即付款',
      body: '你有未繳費項目。付清後即可正常進場，唔需要等人工處理。',
      action: '立即付款', onPress: args.onPay,
    });
  }
  if (hasExpired) {
    cards.push({
      key: 'expired',
      icon: 'card-outline', iconColor: colors.amber, iconBg: colors.amberBg,
      title: '會籍已過期',
      body: '你嘅會籍已到期，請聯絡職員或到帳戶頁面更新資料以繼續使用。',
      action: '查看帳戶', onPress: args.onProfile,
    });
  }

  // ── Milestone progress ──
  const next = MILESTONES.find(m => totalVisits < m);
  if (next) {
    const toGo = next - totalVisits;
    const pct  = Math.round((totalVisits / next) * 100);
    cards.push({
      key: 'milestone',
      icon: 'trophy-outline', iconColor: colors.amber, iconBg: colors.amberBg,
      title: `到訪里程碑：${totalVisits} / ${next} 次`,
      body: `仲差 ${toGo} 次就達成 ${next} 次到訪徽章！（進度 ${pct}%）`,
    });
  } else {
    cards.push({
      key: 'milestone-done',
      icon: 'trophy', iconColor: colors.amber, iconBg: colors.amberBg,
      title: '所有里程碑已達成 🏆',
      body: `你已完成 10 / 50 / 100 / 200 次到訪，總到訪 ${totalVisits} 次。繼續保持！`,
    });
  }

  // ── Streak ──
  if (streak >= 2) {
    cards.push({
      key: 'streak',
      icon: 'flame', iconColor: '#F97316', iconBg: '#FFF7ED',
      title: `🔥 連續 ${streak} 星期落場`,
      body: streak >= 4
        ? `連續 ${streak} 星期！你係 GO24 嘅健身常客，繼續保持紀律。`
        : `已連續 ${streak} 星期，繼續落場就可以建立長期習慣！`,
    });
  } else if (streak === 0) {
    cards.push({
      key: 'streak-start',
      icon: 'flame-outline', iconColor: colors.textMuted, iconBg: colors.bg,
      title: '開始你的連續記錄',
      body: '今個星期落場就可以開始計算連續記錄，建立運動習慣從今天開始。',
      action: '預約課堂', onPress: args.onClasses,
    });
  }

  // ── PT sessions ──
  if (ptRemaining >= 5) {
    cards.push({
      key: 'pt-plenty',
      icon: 'barbell-outline', iconColor: colors.teal, iconBg: colors.tealBg,
      title: `你有 ${ptRemaining} 堂 PT 未用`,
      body: '記得定期預約私人教練課堂，唔好讓 sessions 白白過期。',
      action: '預約 PT', onPress: args.onPT,
    });
  } else if (ptRemaining > 0 && ptRemaining < 5) {
    cards.push({
      key: 'pt-low',
      icon: 'barbell', iconColor: colors.teal, iconBg: colors.tealBg,
      title: `PT 只剩 ${ptRemaining} 堂`,
      body: '你嘅 PT sessions 快用完，請聯絡教練或職員安排續購。',
      action: '查看 PT', onPress: args.onPT,
    });
  }

  // ── Monthly activity ──
  if (monthVisits === 0 && monthClasses === 0) {
    cards.push({
      key: 'inactive',
      icon: 'walk-outline', iconColor: colors.indigo, iconBg: colors.indigoBg,
      title: '今個月未有落場記錄',
      body: '立即預約課堂，開始本月嘅健身旅程！',
      action: '睇課堂時間表', onPress: args.onClasses,
    });
  } else {
    const total = monthVisits + monthClasses;
    cards.push({
      key: 'monthly',
      icon: 'stats-chart-outline', iconColor: colors.indigo, iconBg: colors.indigoBg,
      title: `本月已落場 ${total} 次`,
      body: `入場 ${monthVisits} 次 · 上課 ${monthClasses} 堂。${total >= 8 ? '非常積極，繼續！' : '目標每星期最少 2 次，你做到㗎！'}`,
    });
  }

  // ── Membership expiry warning (not yet expired) ──
  if (!hasExpired && daysRemaining != null && daysRemaining <= 30 && daysRemaining > 0) {
    cards.push({
      key: 'expiry-warn',
      icon: 'calendar-outline', iconColor: colors.warning, iconBg: '#FFFBF0',
      title: `會籍 ${daysRemaining} 日後到期`,
      body: '請聯絡職員或到帳戶頁面安排續約，以免影響使用。',
      action: '查看帳戶', onPress: args.onProfile,
    });
  }

  return cards;
}

function InteractiveHub(props: {
  totalVisits: number;
  streak: number;
  ptRemaining: number;
  monthClasses: number;
  monthVisits: number;
  daysRemaining: number | null;
  hasDebt: boolean;
  hasExpired: boolean;
  cardExpired: boolean;
  onPay: () => void;
  onProfile: () => void;
  onPT: () => void;
  onClasses: () => void;
}) {
  const hints = buildHints(props);

  return (
    <View style={hub.wrap}>
      <Text style={s.sectionTitle}>互動 HUB</Text>
      {hints.map(h => (
        <Pressable
          key={h.key}
          style={hub.card}
          onPress={h.onPress}
          disabled={!h.onPress}
        >
          <View style={[hub.iconBox, { backgroundColor: h.iconBg }]}>
            <Ionicons name={h.icon} size={20} color={h.iconColor} />
          </View>
          <View style={hub.content}>
            <Text style={hub.title}>{h.title}</Text>
            <Text style={hub.body}>{h.body}</Text>
            {h.action && (
              <View style={hub.actionRow}>
                <Text style={[hub.actionTxt, { color: h.iconColor }]}>{h.action}</Text>
                <Ionicons name="chevron-forward" size={12} color={h.iconColor} />
              </View>
            )}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const hub = StyleSheet.create({
  wrap:    { gap:8 },
  card:    { flexDirection:'row', alignItems:'flex-start', gap:14,
              marginHorizontal:16, backgroundColor:colors.card, borderRadius:18,
              padding:16,
              shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:6, elevation:1 },
  iconBox: { width:44, height:44, borderRadius:13, alignItems:'center', justifyContent:'center', flexShrink:0 },
  content: { flex:1, gap:4 },
  title:   { fontSize:14, fontFamily:fonts.bold, color:colors.text },
  body:    { fontSize:12, fontFamily:fonts.regular, color:colors.textMuted, lineHeight:18 },
  actionRow:{ flexDirection:'row', alignItems:'center', gap:3, marginTop:4 },
  actionTxt:{ fontSize:12, fontFamily:fonts.semibold },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const [data, setData]             = useState<DashboardData|null>(null);
  const [banners, setBanners]       = useState<Banner[]>([]);
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

  const name        = data?.user?.name ?? '';
  const memberCode  = data?.user?.memberCode ?? null;
  const m           = data?.membership;
  const pt          = data?.pt;
  const unread      = data?.unreadNotifications ?? 0;
  const hasDebt     = (m?.outstandingBalance ?? 0) > 0;
  const streak      = data?.streak ?? 0;
  const totalVisits = data?.totalVisits ?? 0;
  const hasExpired  = m != null && !m.active && (m.daysRemaining == null || m.daysRemaining <= 0);
  const cardExpired = data?.savedCardExpired ?? false;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.card} />

      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable onPress={() => router.push('/profile')} hitSlop={10}>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>{initials(name)}</Text>
          </View>
        </Pressable>
        <View style={{flex:1}}>
          <Text style={s.greetTxt}>{greeting()}</Text>
          <Text style={s.nameTxt} numberOfLines={1}>{name || 'Welcome back'}</Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/notifications')} hitSlop={10} style={s.bell}>
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
          {unread > 0 && (
            <View style={s.notifDot}><Text style={s.notifTxt}>{unread>9?'9+':unread}</Text></View>
          )}
        </Pressable>
      </View>

      {/* ── Scroll ── */}
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Membership card */}
        <MemberCard m={m} pt={pt} name={name} memberCode={memberCode} onPress={() => router.push('/profile')} />

        {/* Alerts */}
        {hasDebt && (
          <Pressable style={s.alert} onPress={() => router.push('/profile')}>
            <Ionicons name="alert-circle" size={16} color={colors.primary} />
            <Text style={s.alertTxt}>
              Outstanding HK${m!.outstandingBalance.toLocaleString('en-HK',{minimumFractionDigits:2})} — tap to pay
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        )}
        {!hasDebt && m && m.daysRemaining != null && m.daysRemaining <= 30 && (
          <View style={[s.alert,{backgroundColor:m.daysRemaining<=0?'#FFF5F5':'#FFFBF0',borderColor:m.daysRemaining<=0?colors.error:colors.warning}]}>
            <Ionicons name={m.daysRemaining<=0?'alert-circle':'warning'} size={16} color={m.daysRemaining<=0?colors.error:colors.warning} />
            <Text style={[s.alertTxt,{color:m.daysRemaining<=0?colors.error:colors.amber}]}>
              {m.daysRemaining<=0 ? 'Membership expired' : `Expires in ${m.daysRemaining} days`}
            </Text>
          </View>
        )}

        {/* Streak banner */}
        {streak > 0 && (
          <View style={s.streakBanner}>
            <Text style={s.streakEmoji}>🔥</Text>
            <Text style={s.streakText}>{streak}-week streak — keep it up!</Text>
          </View>
        )}

        {/* Stats — all this month */}
        <StatRow
          visits={data?.thisMonth.visits ?? 0}
          pt={data?.thisMonth.pt ?? 0}
          classes={data?.thisMonth.classes ?? 0}
        />

        {/* 互動 HUB */}
        <InteractiveHub
          totalVisits={totalVisits}
          streak={streak}
          ptRemaining={pt?.remainingSessions ?? 0}
          monthClasses={data?.thisMonth.classes ?? 0}
          monthVisits={data?.thisMonth.visits ?? 0}
          daysRemaining={m?.daysRemaining ?? null}
          hasDebt={hasDebt}
          hasExpired={hasExpired}
          cardExpired={cardExpired}
          onPay={() => router.push('/profile')}
          onProfile={() => router.push('/profile')}
          onPT={() => router.push('/(tabs)/pt')}
          onClasses={() => router.push('/(tabs)/classes')}
        />

        {/* Banners — always visible; shows placeholder when empty */}
        <Text style={s.sectionTitle}>Promotions</Text>
        {banners.length > 0 ? (
          <>
            <FlatList
              data={banners} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              keyExtractor={b=>b.id}
              onMomentumScrollEnd={e=>setBannerIdx(Math.round(e.nativeEvent.contentOffset.x/(W-32)))}
              renderItem={({item})=>(
                <Pressable style={s.banner} onPress={()=>item.linkUrl&&Linking.openURL(item.linkUrl)}>
                  <Image source={{uri:item.imageUrl}} style={s.bannerImg} resizeMode="cover" />
                  {item.title&&<View style={s.bannerOverlay}><Text style={s.bannerTitle}>{item.title}</Text></View>}
                </Pressable>
              )}
            />
            {banners.length>1&&(
              <View style={s.dots}>
                {banners.map((_,i)=><View key={i} style={[s.dot,i===bannerIdx&&s.dotActive]} />)}
              </View>
            )}
          </>
        ) : (
          <View style={s.bannerEmpty}>
            <Ionicons name="megaphone-outline" size={28} color={colors.textMuted} />
            <Text style={s.bannerEmptyTxt}>No promotions right now</Text>
            <Text style={s.bannerEmptySub}>Check back soon for offers</Text>
          </View>
        )}

        {/* Next class */}
        <NextCard next={data?.nextClass ?? null} onBook={() => router.push('/(tabs)/classes')} />

        {/* Actions grid */}
        <Text style={s.sectionTitle}>Quick Actions</Text>
        <View style={s.grid}>
          {ACTIONS.map(a => (
            <ActionCell key={a.label} {...a} />
          ))}
        </View>

        <View style={{height:8}} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex:1, backgroundColor:colors.bg },
  scroll: { paddingTop:16, paddingBottom:40, gap:12 },

  header: {
    flexDirection:'row', alignItems:'center', gap:12,
    paddingHorizontal:16, paddingVertical:12,
    backgroundColor:colors.card,
    borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:colors.border,
  },
  avatar:    { width:42, height:42, borderRadius:21, backgroundColor:colors.primary, alignItems:'center', justifyContent:'center' },
  avatarTxt: { fontSize:16, fontFamily:fonts.black, color:'#fff' },
  greetTxt:  { fontSize:11, fontFamily:fonts.regular, color:colors.textMuted },
  nameTxt:   { fontSize:17, fontFamily:fonts.bold, color:colors.text },
  bell:      { width:42, height:42, alignItems:'center', justifyContent:'center' },
  notifDot:  { position:'absolute', top:4, right:4, minWidth:15, height:15, borderRadius:8,
                backgroundColor:colors.cta, alignItems:'center', justifyContent:'center', paddingHorizontal:3 },
  notifTxt:  { color:'#fff', fontSize:8, fontFamily:fonts.black },

  alert: {
    flexDirection:'row', alignItems:'center', gap:8,
    marginHorizontal:16, backgroundColor:colors.primaryBg,
    borderWidth:1, borderColor:colors.primary+'25',
    borderRadius:14, paddingHorizontal:14, paddingVertical:12,
  },
  alertTxt: { flex:1, fontSize:13, fontFamily:fonts.semibold, color:colors.primary },

  sectionTitle: { fontSize:17, fontFamily:fonts.black, color:colors.text, paddingHorizontal:16 },

  streakBanner: {
    flexDirection:'row', alignItems:'center', gap:8,
    marginHorizontal:16, backgroundColor:colors.amberBg,
    borderRadius:12, paddingHorizontal:14, paddingVertical:11,
    borderWidth:1, borderColor:colors.amber+'40',
  },
  streakEmoji: { fontSize:18 },
  streakText:  { fontSize:13, fontFamily:fonts.semibold, color:colors.amber },

  grid: { flexDirection:'row', flexWrap:'wrap', paddingHorizontal:16, gap:10 },

  bannerEmpty: {
    marginHorizontal:16, backgroundColor:colors.card, borderRadius:18,
    height:120, alignItems:'center', justifyContent:'center', gap:6,
    borderWidth:1.5, borderColor:colors.border, borderStyle:'dashed',
  },
  bannerEmptyTxt: { fontSize:14, fontFamily:fonts.semibold, color:colors.textMuted },
  bannerEmptySub: { fontSize:12, fontFamily:fonts.regular, color:colors.textMuted },

  banner:        { width:W-32, height:170, borderRadius:18, overflow:'hidden', marginHorizontal:16 },
  bannerImg:     { width:'100%', height:'100%' },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.28)', justifyContent:'flex-end', padding:16 },
  bannerTitle:   { color:'#fff', fontFamily:fonts.bold, fontSize:15 },
  dots:          { flexDirection:'row', justifyContent:'center', gap:5 },
  dot:           { width:5, height:5, borderRadius:3, backgroundColor:colors.border },
  dotActive:     { backgroundColor:colors.primary, width:14 },
});
