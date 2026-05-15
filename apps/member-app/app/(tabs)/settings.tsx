import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Modal, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../src/api/client';
import { colors, fonts, spacing, radius, shadows } from '../../src/theme';
import { ScreenWrapper, EmptyState } from '../../src/components';
import { useAuth } from '../../src/auth/context';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileData {
  hasMembership: boolean;
  member: {
    pgmId: number;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    memberCode: string | null;
  };
  balance: {
    outstanding: number;
    currency: string;
    invoices: Array<{ id: number; description: string | null; amount: number; dueDate: string | null; status: string }>;
  };
  savedCard: {
    brand: string | null;
    summary: string | null;
    expiryMonth: string | null;
    expiryYear: string | null;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtHkd(amount: number) {
  return `HK$${amount.toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name[0] ?? '?').toUpperCase();
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const anim = useState(new Animated.Value(value ? 1 : 0))[0];
  const handlePress = () => {
    const next = !value;
    Animated.timing(anim, { toValue: next ? 1 : 0, duration: 220, useNativeDriver: false }).start();
    onChange(next);
  };
  const left = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });
  const bg   = anim.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.primary] });
  return (
    <Pressable onPress={handlePress} hitSlop={6}>
      <Animated.View style={[tg.track, { backgroundColor: bg as any }]}>
        <Animated.View style={[tg.thumb, { left }]} />
      </Animated.View>
    </Pressable>
  );
}
const tg = StyleSheet.create({
  track: { width: 48, height: 28, borderRadius: 14, justifyContent: 'center' },
  thumb: { position: 'absolute', top: 2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff',
           shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
});

// ─── Row Icon ─────────────────────────────────────────────────────────────────

function RowIcon({ icon }: { icon: React.ComponentProps<typeof Ionicons>['name'] }) {
  return (
    <View style={ri.box}>
      <Ionicons name={icon} size={14} color={colors.text} />
    </View>
  );
}
const ri = StyleSheet.create({
  box: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});

// ─── Toggle Row ───────────────────────────────────────────────────────────────

function ToggleRow({ icon, label, hint, value, onChange }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string; hint?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <View style={rs.row}>
      <RowIcon icon={icon} />
      <View style={{ flex: 1 }}>
        <Text style={rs.label} numberOfLines={1}>{label}</Text>
        {hint && <Text style={rs.hint} numberOfLines={1}>{hint}</Text>}
      </View>
      <Toggle value={value} onChange={onChange} />
    </View>
  );
}

// ─── Nav Row ──────────────────────────────────────────────────────────────────

function NavRow({ icon, label, value, onPress }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string; value?: string; onPress?: () => void;
}) {
  return (
    <Pressable style={rs.row} onPress={onPress}>
      <RowIcon icon={icon} />
      <Text style={[rs.label, { flex: 1 }]} numberOfLines={1}>{label}</Text>
      {value && <Text style={rs.value} numberOfLines={1}>{value}</Text>}
      <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
    </Pressable>
  );
}

const rs = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: spacing.md - 2, paddingHorizontal: spacing.base, paddingVertical: spacing.md },
  label: { fontSize: 13, fontFamily: fonts.black, color: colors.text },
  hint:  { fontSize: 11, fontFamily: fonts.bold, color: colors.textMuted, marginTop: 2 },
  value: { fontSize: 11, fontFamily: fonts.bold, color: colors.textMuted, maxWidth: 120 },
});

// ─── Group Card ───────────────────────────────────────────────────────────────

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  const arr = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <View>
      <Text style={gs.label}>{label.toUpperCase()}</Text>
      <View style={gs.card}>
        {arr.map((child, i) => (
          <View key={i}>
            {child}
            {i < arr.length - 1 && <View style={gs.divider} />}
          </View>
        ))}
      </View>
    </View>
  );
}
const gs = StyleSheet.create({
  label:   { fontSize: 10, fontFamily: fonts.black, color: colors.textMuted, letterSpacing: 1.5, paddingHorizontal: 4, marginBottom: spacing.sm },
  card:    { backgroundColor: colors.card, borderRadius: radius.xl + 4, overflow: 'hidden', ...shadows.card },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 64 },
});

// ─── Logout Sheet ─────────────────────────────────────────────────────────────

function LogoutSheet({ visible, onCancel, onConfirm, loading }: {
  visible: boolean; onCancel: () => void; onConfirm: () => void; loading: boolean;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <Pressable style={ls.backdrop} onPress={loading ? undefined : onCancel} />
      <View style={ls.sheet}>
        <View style={ls.handle} />
        <View style={ls.row}>
          <View style={ls.iconBox}>
            <Ionicons name="log-out-outline" size={18} color={colors.cta} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ls.title}>Log out of GO24?</Text>
            <Text style={ls.sub}>You'll need to sign in again to view your bookings.</Text>
          </View>
        </View>
        <View style={ls.btnRow}>
          <Pressable style={[ls.btn, ls.cancelBtn, loading && { opacity: 0.5 }]} onPress={onCancel} disabled={loading}>
            <Text style={ls.cancelTxt}>Cancel</Text>
          </Pressable>
          <Pressable style={[ls.btn, ls.confirmBtn, loading && { opacity: 0.8 }]} onPress={onConfirm} disabled={loading}>
            <Text style={ls.confirmTxt}>{loading ? 'Logging out…' : 'Log out'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
const ls = StyleSheet.create({
  backdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(24,24,27,0.4)' },
  sheet:     { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.card,
               borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: spacing.xl,
               paddingTop: spacing.lg, paddingBottom: spacing['2xl'] },
  handle:    { alignSelf: 'center', width: 48, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: spacing.base },
  row:       { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconBox:   { width: 44, height: 44, borderRadius: radius.md + 2, backgroundColor: colors.cta + '22', alignItems: 'center', justifyContent: 'center' },
  title:     { fontSize: 15, fontFamily: fonts.black, color: colors.text },
  sub:       { fontSize: 11, fontFamily: fonts.bold, color: colors.textMuted, marginTop: 2 },
  btnRow:    { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  btn:       { flex: 1, height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { backgroundColor: colors.bg },
  confirmBtn:{ backgroundColor: colors.cta, ...shadows.card },
  cancelTxt: { fontSize: 13, fontFamily: fonts.black, color: colors.text },
  confirmTxt:{ fontSize: 13, fontFamily: fonts.black, color: '#fff' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [data, setData]       = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying]   = useState(false);
  const [error, setError]     = useState('');

  // Preferences (local state, future: persist + sync)
  const [pushNotif, setPushNotif]               = useState(true);
  const [bookingReminders, setBookingReminders] = useState(true);
  const [marketing, setMarketing]               = useState(false);
  const [darkMode, setDarkMode]                 = useState(false);
  const [healthSync, setHealthSync]             = useState(true);

  // Logout state
  const [showLogout, setShowLogout]   = useState(false);
  const [loggingOut, setLoggingOut]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data: d } = await apiClient.get<ProfileData>('/me/profile');
      setData(d);
    } catch {
      setError('Unable to load profile');
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handlePayNow = () => {
    if (!data?.balance.outstanding) return;
    const card = data.savedCard;
    Alert.alert(
      'Pay Outstanding Balance',
      card
        ? `Charge ${fmtHkd(data.balance.outstanding)} to your ${card.brand?.toUpperCase() ?? 'card'} ending ···· ${card.summary}?`
        : `Pay ${fmtHkd(data.balance.outstanding)} outstanding balance?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pay Now', onPress: async () => {
            setPaying(true);
            try {
              const { data: r } = await apiClient.post<{ success: boolean; resultCode: string; amountCharged: number }>('/me/pay-outstanding', {});
              if (r.success) Alert.alert('Payment Successful', `${fmtHkd(r.amountCharged)} charged successfully.`, [{ text: 'OK', onPress: load }]);
              else Alert.alert('Payment Failed', `Result: ${r.resultCode}. Please contact staff.`);
            } catch { Alert.alert('Error', 'Payment failed. Please try again or contact staff.'); }
            finally { setPaying(false); }
          },
        },
      ],
    );
  };

  function handleConfirmLogout() {
    setLoggingOut(true);
    setTimeout(() => {
      setShowLogout(false);
      setLoggingOut(false);
      logout();
    }, 400);
  }

  const memberName  = data?.member.name ?? 'Member';
  const memberCode  = data?.member.memberCode ?? data?.member.pgmId ?? '—';
  const tier        = data?.hasMembership ? 'Premium' : 'Day pass';

  return (
    <ScreenWrapper barStyle="dark-content">
      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : error ? (
        <View style={s.center}>
          <EmptyState icon="cloud-offline-outline" title="Unable to load" subtitle={error} action="Try Again" onAction={load} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>Settings</Text>
            <Text style={s.subtitle}>Personalise your experience</Text>
          </View>

          {/* Profile card */}
          <Pressable
            style={s.profileCard}
            onPress={() => router.push('/membership' as any)}
          >
            <LinearGradient
              colors={[colors.primaryMid, colors.primaryDark]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.avatar}
            >
              <Text style={s.avatarTxt}>{getInitials(data?.member.name ?? null)}</Text>
            </LinearGradient>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.profileName} numberOfLines={1}>{memberName}</Text>
              <Text style={s.profileMeta} numberOfLines={1}>
                Member #{memberCode} · {tier}
              </Text>
              <View style={s.vipPill}>
                <Ionicons name="sparkles" size={9} color={colors.primary} />
                <Text style={s.vipTxt}>VIP</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>

          {/* Outstanding balance — only when there's debt */}
          {data && data.balance.outstanding > 0 && (
            <View style={s.balanceCard}>
              <View style={s.balanceTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.balanceLbl}>OUTSTANDING BALANCE</Text>
                  <Text style={s.balanceAmt}>{fmtHkd(data.balance.outstanding)}</Text>
                </View>
                <Ionicons name="alert-circle" size={28} color="rgba(255,255,255,0.85)" />
              </View>
              <Pressable
                style={[s.payBtn, paying && { opacity: 0.7 }]}
                onPress={data.savedCard ? handlePayNow : () => router.push('/payment/update-card')}
                disabled={paying}
              >
                <Text style={s.payTxt}>
                  {paying ? 'Processing…' : data.savedCard
                    ? `Pay Now — ···· ${data.savedCard.summary}`
                    : 'Add Card to Pay'}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Notifications */}
          <Group label="Notifications">
            <ToggleRow icon="notifications-outline" label="Push notifications" hint="Class reminders, achievements"
              value={pushNotif} onChange={setPushNotif} />
            <ToggleRow icon="phone-portrait-outline" label="Booking reminders" hint="30 min before each session"
              value={bookingReminders} onChange={setBookingReminders} />
            <ToggleRow icon="heart-outline" label="Marketing & offers"
              value={marketing} onChange={setMarketing} />
          </Group>

          {/* Preferences */}
          <Group label="Preferences">
            <ToggleRow icon="moon-outline" label="Dark mode"
              value={darkMode} onChange={setDarkMode} />
            <NavRow icon="globe-outline" label="Language" value="English" />
            <ToggleRow icon="heart-outline" label="Apple Health sync" hint="Sessions, calories, heart rate"
              value={healthSync} onChange={setHealthSync} />
          </Group>

          {/* Account */}
          <Group label="Account">
            <NavRow icon="person-outline" label="Personal info" onPress={() => router.push('/membership' as any)} />
            <NavRow
              icon="card-outline"
              label="Payment methods"
              value={data?.savedCard ? `${data.savedCard.brand?.toUpperCase() ?? 'CARD'} •• ${data.savedCard.summary}` : 'Add card'}
              onPress={() => router.push('/payment/update-card')}
            />
            <NavRow icon="receipt-outline" label="Payment history" onPress={() => router.push('/payments/history')} />
            <NavRow icon="lock-closed-outline" label="Password & security" />
          </Group>

          {/* Support */}
          <Group label="Support">
            <NavRow icon="help-circle-outline" label="Help center" />
            <NavRow icon="document-text-outline" label="Terms & privacy" />
          </Group>

          {/* Logout */}
          <Pressable style={s.logoutBtn} onPress={() => setShowLogout(true)}>
            <Ionicons name="log-out-outline" size={14} color={colors.cta} />
            <Text style={s.logoutTxt}>Log out</Text>
          </Pressable>

          <Text style={s.version}>GO24 FITNESS · v1.4.2</Text>
        </ScrollView>
      )}

      <LogoutSheet
        visible={showLogout}
        loading={loggingOut}
        onCancel={() => setShowLogout(false)}
        onConfirm={handleConfirmLogout}
      />
    </ScreenWrapper>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: 40, gap: spacing.lg },

  header:   { paddingHorizontal: 4 },
  title:    { fontSize: 26, fontFamily: fonts.black, color: colors.text },
  subtitle: { fontSize: 12, fontFamily: fonts.bold, color: colors.textMuted, marginTop: 3 },

  // Profile card
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md + 2,
    backgroundColor: colors.card, borderRadius: radius.xl + 4,
    padding: spacing.base, ...shadows.card,
  },
  avatar:      { width: 56, height: 56, borderRadius: radius.md + 4, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:   { fontSize: 18, fontFamily: fonts.black, color: '#fff' },
  profileName: { fontSize: 15, fontFamily: fonts.black, color: colors.text },
  profileMeta: { fontSize: 11, fontFamily: fonts.bold, color: colors.textMuted, marginTop: 2 },
  vipPill:     { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start',
                 paddingHorizontal: spacing.sm, paddingVertical: 2,
                 borderRadius: radius.full, backgroundColor: colors.primaryBg, marginTop: 6 },
  vipTxt:      { fontSize: 10, fontFamily: fonts.black, color: colors.primary, letterSpacing: 1 },

  // Balance
  balanceCard: { backgroundColor: colors.primary, borderRadius: radius.xl + 4, padding: spacing.base, gap: spacing.md, ...shadows.card },
  balanceTop:  { flexDirection: 'row', alignItems: 'flex-start' },
  balanceLbl:  { fontSize: 10, fontFamily: fonts.black, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.2 },
  balanceAmt:  { fontSize: 24, fontFamily: fonts.black, color: '#fff', marginTop: 4 },
  payBtn:      { backgroundColor: '#fff', height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  payTxt:      { fontSize: 13, fontFamily: fonts.black, color: colors.primary },

  // Logout
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
               height: 48, borderRadius: radius.full, backgroundColor: colors.card, ...shadows.card },
  logoutTxt: { fontSize: 13, fontFamily: fonts.black, color: colors.cta },

  version:   { fontSize: 10, fontFamily: fonts.bold, color: colors.textMuted, textAlign: 'center', marginTop: -spacing.sm },
});
