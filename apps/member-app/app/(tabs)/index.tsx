import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Animated, Dimensions, FlatList, Image, Linking,
  Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, View, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { apiClient } from '../../src/api/client';
import { colors, fonts, spacing, type as t, radius, shadows } from '../../src/theme';
import { Avatar, ScreenWrapper } from '../../src/components';

const { width: W } = Dimensions.get('window');
const CELL = (W - spacing.base * 2 - 10) / 2;

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
  nextClass: { bookingId: string; classId: number; className?: string | null; startTime: string; endTime?: string | null; minutesUntil: number; clubName: string | null } | null;
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
function eta(min: number) {
  if (min <= 0) return 'Now';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60), m = min % 60;
  return h < 24 ? `${h}h${m ? `${m}m` : ''}` : `${Math.floor(h / 24)}d`;
}
function fmtDate(iso: string | null) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-HK', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

// ─── Membership Card ──────────────────────────────────────────────────────────

function MemberCard({ m, pt, name, memberCode, onPress }: {
  m: DashboardData['membership'] | undefined;
  pt: DashboardData['pt'] | undefined;
  name: string;
  memberCode: string | null;
  onPress: () => void;
}) {
  const days = m?.daysRemaining ?? null;
  const pct  = days != null ? Math.max(0, Math.min(1, days / 365)) : null;

  const body = (
    <Pressable onPress={onPress} style={mc.body}>
      {/* decorative circles */}
      <View style={mc.c1} /><View style={mc.c2} />

      {/* top — brand labels + active pill */}
      <View style={mc.top}>
        <View>
          <Text style={mc.brand}>GO24 FITNESS</Text>
          <Text style={mc.brandSub}>MEMBERSHIP CARD</Text>
        </View>
        <View style={[mc.pill, { backgroundColor: m?.active ? 'rgba(74,222,128,0.22)' : 'rgba(255,255,255,0.12)' }]}>
          <View style={[mc.dot, { backgroundColor: m?.active ? '#4ADE80' : 'rgba(255,255,255,0.4)' }]} />
          <Text style={mc.pillTxt}>{m?.active ? 'ACTIVE' : 'INACTIVE'}</Text>
        </View>
      </View>

      {/* centre — plan name BIG + member name */}
      <View style={mc.centre}>
        <Text style={mc.planBig} numberOfLines={1}>{m?.planName ?? 'Membership'}</Text>
        <Text style={mc.memberName} numberOfLines={1}>{name || '—'}</Text>
      </View>

      {/* bottom — 3-col: EXPIRES / DAYS LEFT / PT LEFT */}
      <View style={mc.bottom}>
        <View style={mc.col}>
          <Text style={mc.metaLabel}>EXPIRES</Text>
          <Text style={mc.metaVal}>{fmtDate(m?.expiresAt ?? null)}</Text>
        </View>
        <View style={[mc.col, { alignItems: 'center' }]}>
          <Text style={mc.metaLabel}>DAYS LEFT</Text>
          <Text style={mc.metaVal}>{days != null ? (days > 0 ? days : 'Expired') : '—'}</Text>
        </View>
        <View style={[mc.col, { alignItems: 'flex-end' }]}>
          <Text style={mc.metaLabel}>PT LEFT</Text>
          <Text style={mc.metaVal}>{pt?.remainingSessions ?? 0}</Text>
        </View>
      </View>

      {pct != null && (
        <View style={mc.bar}><View style={[mc.fill, { width: `${pct * 100}%` as any }]} /></View>
      )}
    </Pressable>
  );

  if (Platform.OS === 'web')
    return <View style={[mc.card, { backgroundColor: colors.primaryMid }]}>{body}</View>;
  return (
    <LinearGradient colors={[colors.primaryMid, colors.primaryDark]}
      start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={mc.card}>{body}
    </LinearGradient>
  );
}

const mc = StyleSheet.create({
  card:  { marginHorizontal: spacing.base, borderRadius: radius.xl + 4, height: 200, overflow: 'hidden',
            shadowColor: colors.primaryDark, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 18, elevation: 10 },
  body:  { flex: 1, padding: spacing.lg + 2, justifyContent: 'space-between' },
  c1:    { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)', top: -70, right: -50 },
  c2:    { position: 'absolute', width: 130, height: 130, borderRadius: 65,  backgroundColor: 'rgba(255,255,255,0.04)', bottom: -50, left: 10 },
  top:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand:      { fontSize: 11, fontFamily: fonts.black, color: 'rgba(255,255,255,0.85)', letterSpacing: 2 },
  brandSub:   { fontSize: 9, fontFamily: fonts.semibold, color: 'rgba(255,255,255,0.55)', letterSpacing: 2, marginTop: 2 },
  pill:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md - 2, paddingVertical: 4, borderRadius: radius.full },
  dot:        { width: 6, height: 6, borderRadius: 3 },
  pillTxt:    { fontSize: 10, fontFamily: fonts.black, color: '#fff', letterSpacing: 1 },
  centre:     { gap: 2 },
  planBig:    { fontSize: 28, fontFamily: fonts.black, color: '#fff', lineHeight: 32 },
  memberName: { fontSize: 14, fontFamily: fonts.bold, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  bottom:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  col:        { gap: 2 },
  metaLabel: { fontSize: 9, fontFamily: fonts.semibold, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, marginBottom: 2 },
  metaVal:   { fontSize: 13, fontFamily: fonts.bold, color: 'rgba(255,255,255,0.85)' },
  bar:   { height: 3, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  fill:  { height: '100%', backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 3 },
});

// ─── Stat Row — 3 separate cards ─────────────────────────────────────────────

function StatRow({ visits, pt, classes }: { visits: number; pt: number; classes: number }) {
  const items = [
    { label: 'VISITS',  val: visits,  color: colors.primary, icon: 'calendar-outline' as const },
    { label: 'PT',      val: pt,      color: colors.teal,    icon: 'barbell-outline'  as const },
    { label: 'CLASSES', val: classes, color: colors.indigo,  icon: 'people-outline'   as const },
  ];
  return (
    <View style={sr.outer}>
      <Text style={sr.period}>THIS MONTH</Text>
      <View style={sr.row}>
        {items.map(it => (
          <View key={it.label} style={sr.card}>
            <View style={[sr.iconBox, { backgroundColor: it.color + '15' }]}>
              <Ionicons name={it.icon} size={16} color={it.color} />
            </View>
            <Text style={sr.num}>{it.val}</Text>
            <Text style={sr.lbl}>{it.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
const sr = StyleSheet.create({
  outer:  { marginHorizontal: spacing.base, gap: spacing.sm },
  period: { ...t.overline, color: colors.textMuted },
  row:    { flexDirection: 'row', gap: spacing.sm },
  card:   { flex: 1, backgroundColor: colors.card, borderRadius: radius.xl,
            padding: spacing.base, gap: spacing.xs, ...shadows.card },
  iconBox:{ width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  num:    { fontSize: 28, fontFamily: fonts.black, color: colors.text },
  lbl:    { fontSize: 9, fontFamily: fonts.bold, color: colors.textMuted, letterSpacing: 0.8 },
});

// ─── Next Class Card ──────────────────────────────────────────────────────────

function NextCard({ next, onBook }: { next: DashboardData['nextClass'] | null; onBook: () => void }) {
  if (!next) return (
    <Pressable style={nc.empty} onPress={onBook}>
      <View style={nc.emptyIcon}>
        <Ionicons name="calendar-outline" size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={nc.emptyTitle}>No upcoming classes</Text>
        <Text style={nc.emptySub}>Browse the schedule and book</Text>
      </View>
      <View style={nc.emptyBtn}><Text style={nc.emptyBtnTxt}>Book</Text></View>
    </Pressable>
  );

  const time = new Date(next.startTime).toLocaleTimeString('en-HK', { hour: '2-digit', minute: '2-digit', hour12: false });
  const date = new Date(next.startTime).toLocaleDateString('en-HK', { weekday: 'short', month: 'short', day: 'numeric' });

  const dur = Math.round((new Date(next.endTime ?? next.startTime).getTime() - new Date(next.startTime).getTime()) / 60000);
  const isToday = new Date(next.startTime).toDateString() === new Date().toDateString();

  return (
    <View style={nc.card}>
      <View style={nc.stripe} />
      <View style={nc.inner}>
        <Text style={nc.eyebrowRow}>
          <Text style={nc.eyebrow}>{isToday ? 'TODAY' : date.toUpperCase()}</Text>
          <Text style={nc.dot}> · </Text>
          <Text style={nc.eyebrow}>{time}</Text>
          {dur > 0 && (<>
            <Text style={nc.dot}> · </Text>
            <Text style={nc.eyebrowMuted}>{dur} min</Text>
          </>)}
        </Text>
        <Text style={nc.name} numberOfLines={2}>{next.className ?? `Class #${next.classId}`}</Text>
        {next.clubName && (
          <View style={nc.metaItem}>
            <Ionicons name="location-outline" size={12} color={colors.textMuted} />
            <Text style={nc.metaTxt} numberOfLines={1}>{next.clubName}</Text>
          </View>
        )}
      </View>
      <View style={nc.checkInWrap}>
        <View style={nc.checkInBtn}>
          <Text style={nc.checkInTxt}>Check in</Text>
        </View>
      </View>
    </View>
  );
}
const nc = StyleSheet.create({
  empty:      { flexDirection: 'row', alignItems: 'center', gap: spacing.md + 2, marginHorizontal: spacing.base,
                backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg + 2, ...shadows.card },
  emptyIcon:  { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...t.bodyBold, color: colors.text },
  emptySub:   { ...t.bodySm, color: colors.textMuted, marginTop: 2 },
  emptyBtn:   { paddingHorizontal: spacing.md, paddingVertical: 7, backgroundColor: colors.primaryBg, borderRadius: radius.md },
  emptyBtnTxt:{ ...t.label, color: colors.primary },

  card:   { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.base, backgroundColor: colors.card,
            borderRadius: radius.xl, overflow: 'hidden', ...shadows.card },
  stripe: { width: 4, alignSelf: 'stretch', backgroundColor: colors.primary },
  inner:  { flex: 1, padding: spacing.base, gap: spacing.xs },
  eyebrowRow: { marginBottom: 2 },
  eyebrow:    { fontSize: 10, fontFamily: fonts.black, color: colors.primary, letterSpacing: 1 },
  eyebrowMuted: { fontSize: 10, fontFamily: fonts.bold, color: colors.textMuted, letterSpacing: 0.5 },
  dot:        { fontSize: 10, color: colors.textMuted },
  name:       { fontSize: 18, fontFamily: fonts.black, color: colors.text, lineHeight: 22 },
  metaItem:   { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaTxt:    { ...t.bodySm, color: colors.textMuted },
  checkInWrap:{ padding: spacing.base },
  checkInBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, backgroundColor: colors.primaryBg, borderRadius: radius.full },
  checkInTxt: { fontSize: 12, fontFamily: fonts.black, color: colors.primary },
});

// ─── Action Grid Cell ─────────────────────────────────────────────────────────

function ActionCell({ icon, label, color, bg, to, badge, fullWidth }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string; color: string; bg: string; to: string; badge?: boolean; fullWidth?: boolean;
}) {
  const router = useRouter();
  return (
    <Pressable style={[ag.cell, fullWidth && ag.cellFull]} onPress={() => router.push(to as any)}>
      <View style={[ag.icon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={color} />
        {badge && <View style={ag.badge} />}
      </View>
      <Text style={ag.label} numberOfLines={2}>{label}</Text>
      <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
    </Pressable>
  );
}
const ag = StyleSheet.create({
  cell:     { width: CELL, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
              backgroundColor: colors.card, borderRadius: radius.xl,
              paddingHorizontal: spacing.base, paddingVertical: spacing.base, ...shadows.card },
  cellFull: { width: '100%' },
  icon:     { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label:    { flex: 1, ...t.bodyBold, color: colors.text },
  badge:    { position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5,
              backgroundColor: colors.cta, borderWidth: 2, borderColor: colors.card },
});

// ─── Actions data ─────────────────────────────────────────────────────────────

const ACTIONS = [
  { icon: 'calendar'  as const, label: 'Book a Class', to: '/(tabs)/classes',  color: colors.blue,   bg: colors.blueBg   },
  { icon: 'bookmark'  as const, label: 'My Bookings',  to: '/(tabs)/bookings', color: colors.indigo, bg: colors.indigoBg },
  { icon: 'barbell'   as const, label: 'PT Sessions',  to: '/(tabs)/pt',       color: colors.teal,   bg: colors.tealBg   },
  { icon: 'pulse'     as const, label: 'Activity Log', to: '/(tabs)/activity', color: colors.green,  bg: colors.greenBg  },
  { icon: 'qr-code'   as const, label: 'QR Check-in',  to: '/checkin/qr',      color: colors.amber,  bg: colors.amberBg, fullWidth: true  },
];

// ─── Smart Hub ────────────────────────────────────────────────────────────────

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
  totalVisits: number; streak: number; ptRemaining: number;
  monthClasses: number; monthVisits: number; daysRemaining: number | null;
  hasDebt: boolean; hasExpired: boolean; cardExpired: boolean;
  onPay: () => void; onUpdateCard: () => void; onProfile: () => void;
  onPT: () => void; onClasses: () => void;
}): HintCard[] {
  const cards: HintCard[] = [];
  const { totalVisits, streak, ptRemaining, monthClasses, monthVisits,
    daysRemaining, hasDebt, hasExpired, cardExpired } = args;

  if (cardExpired) {
    cards.push({
      key: 'card-expired', icon: 'card', iconColor: colors.primary, iconBg: colors.primaryBg,
      title: 'Credit Card Expired',
      body: 'Your saved card has expired. Automatic payments and in-app payments will fail until you update your card details.',
      action: 'Update Card', onPress: args.onUpdateCard,
    });
  }
  if (hasDebt) {
    cards.push({
      key: 'debt', icon: 'alert-circle', iconColor: colors.primary, iconBg: colors.primaryBg,
      title: "Can't Enter? Pay Now",
      body: 'We detected an outstanding balance blocking your entry. Clear it instantly in-app — no need to wait for staff.',
      action: 'Resolve Now', onPress: args.onPay,
    });
  }
  if (hasExpired) {
    cards.push({
      key: 'expired', icon: 'card-outline', iconColor: colors.amber, iconBg: colors.amberBg,
      title: 'Membership Expired',
      body: 'Your membership has lapsed. Contact staff or visit your account page to renew.',
      action: 'My Account', onPress: args.onProfile,
    });
  }

  const next = MILESTONES.find(m => totalVisits < m);
  if (next) {
    const toGo = next - totalVisits;
    const pct  = Math.round((totalVisits / next) * 100);
    cards.push({
      key: 'milestone', icon: 'trophy-outline', iconColor: colors.amber, iconBg: colors.amberBg,
      title: `Visit Milestone: ${totalVisits} / ${next}`,
      body: `${toGo} more visits to earn your ${next}-visit badge! You're ${pct}% there.`,
    });
  } else {
    cards.push({
      key: 'milestone-done', icon: 'trophy', iconColor: colors.amber, iconBg: colors.amberBg,
      title: 'All Milestones Reached',
      body: `You've completed 10 / 50 / 100 / 200 visits with ${totalVisits} total check-ins. Keep it up!`,
    });
  }

  if (streak >= 2) {
    cards.push({
      key: 'streak', icon: 'flame', iconColor: colors.cta, iconBg: colors.ctaBg,
      title: `${streak}-Week Streak`,
      body: streak >= 4
        ? `${streak} weeks straight — you're one of GO24's most dedicated members. Stay consistent!`
        : `${streak} weeks in a row. Keep showing up to build a lasting habit!`,
    });
  } else if (streak === 0) {
    cards.push({
      key: 'streak-start', icon: 'flame-outline', iconColor: colors.textMuted, iconBg: colors.bg,
      title: 'Start Your Streak',
      body: 'Visit the gym this week to kick off your streak. Consistency is everything.',
      action: 'Book a Class', onPress: args.onClasses,
    });
  }

  if (ptRemaining >= 5) {
    cards.push({
      key: 'pt-plenty', icon: 'barbell-outline', iconColor: colors.teal, iconBg: colors.tealBg,
      title: `${ptRemaining} PT Sessions Available`,
      body: "Book your personal training sessions regularly so they don't go to waste.",
      action: 'Book PT', onPress: args.onPT,
    });
  } else if (ptRemaining > 0 && ptRemaining < 5) {
    cards.push({
      key: 'pt-low', icon: 'barbell', iconColor: colors.teal, iconBg: colors.tealBg,
      title: `Only ${ptRemaining} PT Session${ptRemaining > 1 ? 's' : ''} Left`,
      body: 'Your PT sessions are running low. Contact your trainer or staff to top up.',
      action: 'View PT', onPress: args.onPT,
    });
  }

  if (monthVisits === 0 && monthClasses === 0) {
    cards.push({
      key: 'inactive', icon: 'walk-outline', iconColor: colors.indigo, iconBg: colors.indigoBg,
      title: 'No Visits This Month Yet',
      body: 'Book a class and kick off your month. Every session counts!',
      action: 'View Schedule', onPress: args.onClasses,
    });
  } else {
    const total = monthVisits + monthClasses;
    cards.push({
      key: 'monthly', icon: 'stats-chart-outline', iconColor: colors.indigo, iconBg: colors.indigoBg,
      title: `${total} Visit${total > 1 ? 's' : ''} This Month`,
      body: `${monthVisits} gym ${monthVisits === 1 ? 'entry' : 'entries'} · ${monthClasses} ${monthClasses === 1 ? 'class' : 'classes'}. ${total >= 8 ? 'Excellent work — keep going!' : "Aim for at least 2 visits per week. You've got this!"}`,
    });
  }

  if (!hasExpired && daysRemaining != null && daysRemaining <= 30 && daysRemaining > 0) {
    cards.push({
      key: 'expiry-warn', icon: 'calendar-outline', iconColor: colors.warning, iconBg: '#FFFBF0',
      title: `Membership Expires in ${daysRemaining} Day${daysRemaining > 1 ? 's' : ''}`,
      body: 'Contact staff or visit your account page to renew before it lapses.',
      action: 'My Account', onPress: args.onProfile,
    });
  }

  return cards;
}

const URGENT_KEYS = new Set(['card-expired', 'debt', 'expired']);

function InteractiveHub(props: {
  totalVisits: number; streak: number; ptRemaining: number;
  monthClasses: number; monthVisits: number; daysRemaining: number | null;
  hasDebt: boolean; hasExpired: boolean; cardExpired: boolean;
  onPay: () => void; onUpdateCard: () => void; onProfile: () => void;
  onPT: () => void; onClasses: () => void;
}) {
  const all    = buildHints(props);
  const urgent = all.filter(h => URGENT_KEYS.has(h.key));
  const info   = all.filter(h => !URGENT_KEYS.has(h.key));

  const [idx, setIdx]   = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const idxRef   = useRef(0);

  const fadeTo = (next: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
    setTimeout(() => { idxRef.current = next; setIdx(next); }, 250);
  };

  useEffect(() => {
    if (info.length <= 1) return;
    const timer = setInterval(() => {
      fadeTo((idxRef.current + 1) % info.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [info.length]);

  const navigate = (dir: 1 | -1) => {
    fadeTo(Math.max(0, Math.min(info.length - 1, idxRef.current + dir)));
  };

  const h = info[idx];

  return (
    <View style={hub.outer}>
      <Text style={[s.sectionLabel, { paddingHorizontal: spacing.base }]}>SMART HUB</Text>

      {/* Pinned urgent alerts */}
      {urgent.map(u => (
        <Pressable key={u.key} style={[hub.card, hub.cardUrgent]} onPress={u.onPress}>
          <View style={[hub.iconBox, { backgroundColor: u.iconBg }]}>
            <Ionicons name={u.icon} size={20} color={u.iconColor} />
          </View>
          <View style={hub.content}>
            <Text style={hub.title}>{u.title}</Text>
            <Text style={hub.bodyTxt}>{u.body}</Text>
            {u.action && (
              <View style={hub.actionRow}>
                <Text style={[hub.actionTxt, { color: u.iconColor }]}>{u.action}</Text>
                <Ionicons name="chevron-forward" size={12} color={u.iconColor} />
              </View>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={u.iconColor} style={{ opacity: 0.5 }} />
        </Pressable>
      ))}

      {/* Cycling info card */}
      {h && (
        <View style={[hub.card, { overflow: 'hidden' }]}>
          {/* Top segmented progress bar */}
          {info.length > 1 && (
            <View style={hub.segRow}>
              {info.map((_, i) => (
                <View key={i} style={[
                  hub.seg,
                  i === idx && { backgroundColor: h.iconColor },
                ]} />
              ))}
            </View>
          )}

          <Pressable style={hub.cardInner} onPress={h.onPress}>
            <View style={[hub.iconBox, { backgroundColor: h.iconBg }]}>
              <Ionicons name={h.icon} size={20} color={h.iconColor} />
            </View>
            <Animated.View style={[hub.content, { opacity: fadeAnim }]}>
              <Text style={[hub.eyebrow, { color: h.iconColor }]} numberOfLines={1}>
                {h.action ? h.action.toUpperCase() : 'INSIGHT'}
              </Text>
              <Text style={hub.title} numberOfLines={1}>{h.title}</Text>
              <Text style={hub.bodyTxt} numberOfLines={2}>{h.body}</Text>
            </Animated.View>
            {h.action && (
              <View style={[hub.ctaPill, { backgroundColor: h.iconColor }]}>
                <Text style={hub.ctaTxt}>{h.action}</Text>
                <Ionicons name="arrow-forward" size={12} color="#fff" />
              </View>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const hub = StyleSheet.create({
  outer:      { gap: spacing.sm },
  card:       { marginHorizontal: spacing.base, backgroundColor: colors.card,
                borderRadius: radius.xl, ...shadows.card },
  cardUrgent: { borderWidth: 1.5, borderColor: colors.primary + '30', flexDirection: 'row',
                alignItems: 'center', gap: spacing.md, padding: spacing.base },
  cardInner:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.base, minHeight: 80 },

  // Top segmented progress bar
  segRow:     { flexDirection: 'row', gap: 4, paddingHorizontal: spacing.base, paddingTop: spacing.md },
  seg:        { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.border },

  iconBox:    { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  content:    { flex: 1, gap: 2 },
  eyebrow:    { fontSize: 9, fontFamily: fonts.black, letterSpacing: 1 },
  title:      { ...t.bodyBold, color: colors.text },
  bodyTxt:    { ...t.bodySm, color: colors.textMuted, lineHeight: 16 },
  actionRow:  { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: spacing.xs + 1 },
  actionTxt:  { ...t.labelSm, fontFamily: fonts.semibold },

  // CTA pill
  ctaPill:    { flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full, flexShrink: 0 },
  ctaTxt:     { color: '#fff', fontSize: 11, fontFamily: fonts.black },

  accentLine: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: colors.primary },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const [data, setData]             = useState<DashboardData | null>(null);
  const [banners, setBanners]       = useState<Banner[]>([]);
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

  // ── DEMO data fallback for __DEV__ when backend fields missing ──
  const DEMO = __DEV__;

  const name        = data?.user?.name ?? 'Alex Chan';
  const memberCode  = data?.user?.memberCode ?? '4000463';
  const m: DashboardData['membership'] = {
    active:    data?.membership?.active ?? true,
    planName:  data?.membership?.planName ?? 'Platinum 24/7',
    daysRemaining: data?.membership?.daysRemaining ?? (DEMO ? 276 : null),
    expiresAt: data?.membership?.expiresAt ?? (DEMO ? '2026-02-14' : null),
    outstandingBalance: data?.membership?.outstandingBalance ?? (DEMO ? 480 : 0),
  };
  const pt: DashboardData['pt'] = {
    remainingSessions: data?.pt?.remainingSessions ?? (DEMO ? 8 : 0),
    totalSessions:     data?.pt?.totalSessions ?? (DEMO ? 20 : 0),
    expiresAt:         data?.pt?.expiresAt ?? null,
  };
  const unread = data?.unreadNotifications ?? (DEMO ? 3 : 0);
  const streak = (data?.streak && data.streak > 0) ? data.streak : (DEMO ? 6 : 0);
  const totalVisits = data?.totalVisits ?? (DEMO ? 88 : 0);

  const demoStart = new Date(); demoStart.setHours(18, 30, 0, 0);
  const nextClass = data?.nextClass ?? (DEMO ? {
    bookingId: 'demo-1', classId: 999, className: 'Power Yoga Flow',
    startTime: demoStart.toISOString(),
    endTime: new Date(demoStart.getTime() + 45 * 60_000).toISOString(),
    minutesUntil: Math.max(0, Math.floor((demoStart.getTime() - Date.now()) / 60000)),
    clubName: 'GO24 Central',
  } : null);

  const demoThisMonth = data?.thisMonth ?? (DEMO ? { visits: 14, classes: 5, pt: 3 } : { visits: 0, classes: 0, pt: 0 });

  const demoBanners: Banner[] = DEMO ? [
    { id: 'b1', title: 'Bring a Friend Week', imageUrl: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=600', linkUrl: null },
    { id: 'b2', title: 'Summer PT Burn',      imageUrl: 'https://images.unsplash.com/photo-1599058917765-a780eda07a3e?w=600', linkUrl: null },
  ] : [];
  const displayBanners = banners.length > 0 ? banners : demoBanners;

  const hasExpired  = m != null && !m.active && (m.daysRemaining == null || m.daysRemaining <= 0);
  const cardExpired = __DEV__ || (data?.savedCardExpired ?? false);
  const hasDebt     = __DEV__ || (m?.outstandingBalance ?? 0) > 0;

  return (
    <ScreenWrapper>

      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable onPress={() => router.push('/(tabs)/settings')} hitSlop={10}>
          <Avatar name={name} size="md" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.greetTxt}>{greeting()}</Text>
          <Text style={s.nameTxt} numberOfLines={1}>{name || 'Welcome back'}</Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/notifications')} hitSlop={10} style={s.bell}>
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
          {unread > 0 && (
            <View style={s.notifDot}><Text style={s.notifTxt}>{unread > 9 ? '9+' : unread}</Text></View>
          )}
        </Pressable>
      </View>

      {/* ── Scroll ── */}
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Membership card */}
        <MemberCard m={m} pt={pt} name={name} memberCode={memberCode} onPress={() => router.push('/(tabs)/settings')} />

        {/* Alerts */}
        {m && (m.outstandingBalance ?? 0) > 0 && (
          <Pressable style={s.alert} onPress={() => router.push('/payment/access-blocked')}>
            <Ionicons name="alert-circle" size={16} color={colors.primary} />
            <Text style={s.alertTxt}>
              Outstanding HK${m.outstandingBalance.toLocaleString('en-HK', { minimumFractionDigits: 2 })} — tap to pay
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        )}
        {m && (m.outstandingBalance ?? 0) === 0 && m.daysRemaining != null && m.daysRemaining <= 30 && (
          <View style={[s.alert, {
            backgroundColor: m.daysRemaining <= 0 ? '#FFF5F5' : '#FFFBF0',
            borderColor: m.daysRemaining <= 0 ? colors.error : colors.warning,
          }]}>
            <Ionicons name={m.daysRemaining <= 0 ? 'alert-circle' : 'warning'} size={16}
              color={m.daysRemaining <= 0 ? colors.error : colors.warning} />
            <Text style={[s.alertTxt, { color: m.daysRemaining <= 0 ? colors.error : colors.amber }]}>
              {m.daysRemaining <= 0 ? 'Membership expired' : `Expires in ${m.daysRemaining} days`}
            </Text>
          </View>
        )}

        {/* Streak banner */}
        {streak > 0 && (
          <Pressable style={s.streakBanner} onPress={() => router.push('/(tabs)/activity')}>
            <LinearGradient
              colors={['#FF8C00', '#FF6B00']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.streakGradient}
            >
              <View style={s.streakIconBox}>
                <Ionicons name="flame" size={20} color={colors.cta} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.streakTitle}>{streak}-week streak</Text>
                <Text style={s.streakSub}>You're on fire — keep showing up.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </Pressable>
        )}

        {/* Stats */}
        <StatRow
          visits={demoThisMonth.visits}
          pt={demoThisMonth.pt}
          classes={demoThisMonth.classes}
        />

        {/* Smart Hub */}
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
          onPay={() => router.push('/payment/access-blocked')}
          onUpdateCard={() => router.push('/payment/update-card')}
          onProfile={() => router.push('/(tabs)/settings')}
          onPT={() => router.push('/(tabs)/pt')}
          onClasses={() => router.push('/(tabs)/classes')}
        />

        {/* FOR YOU */}
        <View style={s.sectionRow}>
          <Text style={s.sectionLabel}>FOR YOU</Text>
          <Pressable><Text style={s.seeAll}>See all</Text></Pressable>
        </View>
        {displayBanners.length > 0 ? (
          <>
            <FlatList
              data={displayBanners} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              keyExtractor={b => b.id}
              onMomentumScrollEnd={e => setBannerIdx(Math.round(e.nativeEvent.contentOffset.x / (W - 32)))}
              renderItem={({ item }) => (
                <Pressable style={s.banner} onPress={() => item.linkUrl && Linking.openURL(item.linkUrl)}>
                  <Image source={{ uri: item.imageUrl }} style={s.bannerImg} resizeMode="cover" />
                  <View style={s.promoTag}><Text style={s.promoTagTxt}>PROMOTION</Text></View>
                  {item.title && (
                    <View style={s.bannerOverlay}>
                      <Text style={s.bannerTitle}>{item.title}</Text>
                    </View>
                  )}
                </Pressable>
              )}
            />
            {displayBanners.length > 1 && (
              <View style={s.dots}>
                {displayBanners.map((_, i) => <View key={i} style={[s.dot, i === bannerIdx && s.dotActive]} />)}
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
        <NextCard next={nextClass as any} onBook={() => router.push('/(tabs)/classes')} />

        {/* Actions grid */}
        <Text style={[s.sectionLabel, { paddingHorizontal: spacing.base }]}>QUICK ACTIONS</Text>
        <View style={s.grid}>
          {ACTIONS.map(a => <ActionCell key={a.label} {...a} fullWidth={a.fullWidth} />)}
        </View>

        <View style={{ height: spacing.sm }} />
      </ScrollView>
    </ScreenWrapper>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { paddingTop: spacing.base, paddingBottom: spacing['3xl'], gap: spacing.md - 4 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.base, paddingVertical: spacing.md - 2,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  greetTxt: { ...t.caption, color: colors.textMuted },
  nameTxt:  { ...t.bodyBold, color: colors.text, fontSize: 17 },
  bell:     { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  notifDot: { position: 'absolute', top: 4, right: 4, minWidth: 15, height: 15, borderRadius: 8,
              backgroundColor: colors.cta, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  notifTxt: { color: '#fff', fontSize: 8, fontFamily: fonts.black },

  alert: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.base, backgroundColor: colors.primaryBg,
    borderWidth: 1, borderColor: colors.primary + '25',
    borderRadius: radius.md + 2, paddingHorizontal: spacing.md, paddingVertical: spacing.md - 2,
  },
  alertTxt: { flex: 1, ...t.label, color: colors.primary },

  streakBanner:   { marginHorizontal: spacing.base, borderRadius: radius.xl, overflow: 'hidden', ...shadows.card },
  streakGradient: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.base },
  streakIconBox:  { width: 40, height: 40, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  streakTitle:    { fontSize: 15, fontFamily: fonts.black, color: '#fff' },
  streakSub:      { fontSize: 12, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.base },
  sectionLabel: { ...t.overline, color: colors.textMuted, letterSpacing: 1.5 },
  seeAll:       { fontSize: 13, fontFamily: fonts.semibold, color: colors.primary },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.base, gap: 10 },

  bannerEmpty: {
    marginHorizontal: spacing.base, backgroundColor: colors.card, borderRadius: radius.lg,
    height: 120, alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed',
  },
  bannerEmptyTxt: { ...t.label, color: colors.textMuted },
  bannerEmptySub: { ...t.bodySm, color: colors.textMuted },

  banner:        { width: W - 32, height: 170, borderRadius: radius.lg, overflow: 'hidden', marginHorizontal: spacing.base },
  bannerImg:     { width: '100%', height: '100%' },
  bannerOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.28)', justifyContent: 'flex-end', padding: spacing.base },
  bannerTitle:   { ...t.bodyBold, color: '#fff' },
  dots:          { flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot:           { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.border },
  dotActive:     { backgroundColor: colors.primary, width: 14 },
  promoTag:      { position: 'absolute', top: 10, left: 10+16, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  promoTagTxt:   { color: '#fff', fontSize: 9, fontFamily: fonts.black, letterSpacing: 1.2 },
});
