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

function MemberCard({ m, name, onPress }: {
  m: DashboardData['membership']|undefined; name: string; onPress: ()=>void;
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

      {/* centre */}
      <View style={mc.centre}>
        <Text style={mc.plan}>{m?.planName?.toUpperCase() ?? 'MEMBERSHIP'}</Text>
        <Text style={mc.memberName} numberOfLines={1}>{name || '—'}</Text>
      </View>

      {/* bottom */}
      <View style={mc.bottom}>
        <View>
          <Text style={mc.metaLabel}>EXPIRES</Text>
          <Text style={mc.metaVal}>{fmtDate(m?.expiresAt ?? null)}</Text>
        </View>
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
  memberName:{ fontSize:26, fontFamily:fonts.black, color:'#fff' },
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
  );
}
const sr = StyleSheet.create({
  wrap:    { flexDirection:'row', marginHorizontal:16, backgroundColor:colors.card,
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
  { icon:'qr-code'               as const, label:'QR Check-in',   to:'/checkin/qr',       color:colors.primary, bg:colors.primaryBg },
  { icon:'calendar'              as const, label:'Book a Class',   to:'/(tabs)/classes',   color:colors.blue,    bg:colors.blueBg    },
  { icon:'bookmark'              as const, label:'My Bookings',    to:'/(tabs)/bookings',  color:colors.indigo,  bg:colors.indigoBg  },
  { icon:'barbell'               as const, label:'PT Sessions',    to:'/(tabs)/pt',        color:colors.teal,    bg:colors.tealBg    },
  { icon:'pulse'                 as const, label:'Activity Log',   to:'/(tabs)/activity',  color:colors.green,   bg:colors.greenBg   },
  { icon:'gift'                  as const, label:'Refer a Friend', to:'/referral',         color:colors.rose,    bg:colors.roseBg    },
];

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

  const name    = data?.user?.name ?? '';
  const m       = data?.membership;
  const pt      = data?.pt;
  const unread  = data?.unreadNotifications ?? 0;
  const hasDebt = (m?.outstandingBalance ?? 0) > 0;

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
        <MemberCard m={m} name={name} onPress={() => router.push('/profile')} />

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

        {/* Stats — all this month */}
        <StatRow
          visits={data?.thisMonth.visits ?? 0}
          pt={data?.thisMonth.pt ?? 0}
          classes={data?.thisMonth.classes ?? 0}
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
            <ActionCell key={a.label} {...a} badge={a.to==='/profile'&&hasDebt} />
          ))}
          <ActionCell
            icon="person-circle-outline"
            label="My Account"
            color={colors.amber}
            bg={colors.amberBg}
            to="/profile"
            badge={hasDebt}
          />
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
