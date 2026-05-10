import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../src/api/client';
import { colors, spacing, type as t, radius, shadows } from '../../src/theme';
import { Avatar, Badge, Button, Card, EmptyState, ListRow, SectionHeader, ScreenWrapper } from '../../src/components';
import { useAuth } from '../../src/auth/context';

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
    invoices: Array<{
      id: number;
      description: string | null;
      amount: number;
      dueDate: string | null;
      status: string;
    }>;
  };
  savedCard: {
    brand: string | null;
    summary: string | null;
    expiryMonth: string | null;
    expiryYear: string | null;
  } | null;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-HK', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

function fmtHkd(amount: number) {
  return `HK$${amount.toLocaleString('en-HK', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name[0] ?? '?').toUpperCase();
}

export default function SettingsScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [data, setData]   = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying]   = useState(false);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: d } = await apiClient.get<ProfileData>('/me/profile');
      setData(d);
    } catch {
      setError('Unable to load profile');
    } finally {
      setLoading(false);
    }
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
        {
          text: 'Pay Now',
          onPress: async () => {
            setPaying(true);
            try {
              const { data: result } = await apiClient.post<{
                success: boolean;
                resultCode: string;
                amountCharged: number;
              }>('/me/pay-outstanding', {});

              if (result.success) {
                Alert.alert(
                  '✅ Payment Successful',
                  `${fmtHkd(result.amountCharged)} charged successfully.`,
                  [{ text: 'OK', onPress: load }],
                );
              } else {
                Alert.alert('Payment Failed', `Result: ${result.resultCode}. Please contact staff.`);
              }
            } catch {
              Alert.alert('Error', 'Payment failed. Please try again or contact staff.');
            } finally {
              setPaying(false);
            }
          },
        },
      ],
    );
  };

  const handleDayPass = () => {
    if (!data?.savedCard) {
      Alert.alert('No Card Saved', 'Please add a payment card first.', [
        { text: 'Add Card', onPress: () => router.push('/payment/update-card') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    const DAY_PASS_PRICE = 'HK$150';
    Alert.alert('Day Pass', `Charge ${DAY_PASS_PRICE} for a day pass?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Buy Now',
        onPress: async () => {
          setPaying(true);
          try {
            const { data: result } = await apiClient.post<{
              success: boolean; resultCode: string; amountCharged: number;
            }>('/payments/pay-daypass', {});
            if (result.success) {
              Alert.alert('✅ Day Pass Active', 'You can enter GO24 today.', [
                { text: 'OK', onPress: load },
              ]);
            } else {
              Alert.alert('Payment Failed', `Result: ${result.resultCode}. Please try again.`);
            }
          } catch {
            Alert.alert('Error', 'Payment failed. Please contact staff.');
          } finally { setPaying(false); }
        },
      },
    ]);
  };

  // Semantic icon colors per action type (ui-ux-pro-max: color-semantic)
  const LINKS: Array<{
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    to: string;
    color: string;
    bg: string;
  }> = [
    { icon: 'card-outline',          label: 'My Memberships',      to: '/membership',            color: colors.primary, bg: colors.primaryBg },
    { icon: 'receipt-outline',       label: 'Payment History',     to: '/payments/history',      color: colors.amber,   bg: colors.amberBg   },
    { icon: 'star-outline',          label: 'Favourite Classes',   to: '/favourites',            color: colors.rose,    bg: colors.roseBg    },
    { icon: 'wallet-outline',        label: 'Update Payment Card', to: '/payment/update-card',   color: colors.green,   bg: colors.greenBg   },
    { icon: 'notifications-outline', label: 'Notifications',       to: '/(tabs)/notifications',  color: colors.indigo,  bg: colors.indigoBg  },
  ];

  return (
    <ScreenWrapper>
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <EmptyState
            icon="cloud-offline-outline"
            title="Unable to load"
            subtitle={error}
            action="Try Again"
            onAction={load}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Profile hero ── */}
          <Card rounded="xl" style={s.profileCard}>
            <Avatar name={data?.member.name} size="xl" />
            <Text style={[t.h3, { color: colors.text, marginTop: spacing.md }]}>
              {data?.member.name ?? '—'}
            </Text>
            <Text style={[t.bodySm, { color: colors.textMuted, marginTop: 2 }]}>
              Member #{data?.member.pgmId}
            </Text>
            {data?.member.memberCode && (
              <Badge label={data.member.memberCode} variant="primary" style={{ marginTop: spacing.sm }} />
            )}
          </Card>

          {/* ── Outstanding balance ── */}
          {data && data.balance.outstanding > 0 ? (
            <View style={s.balanceCard}>
              <View style={s.balanceTop}>
                <View>
                  <Text style={[t.labelSm, { color: 'rgba(255,255,255,0.65)' }]}>Outstanding Balance</Text>
                  <Text style={[t.stat, { color: '#fff', marginTop: 2 }]}>{fmtHkd(data.balance.outstanding)}</Text>
                </View>
                <Ionicons name="alert-circle" size={32} color="rgba(255,255,255,0.8)" />
              </View>

              {data.balance.invoices.map(inv => (
                <View key={inv.id} style={s.invoiceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[t.label, { color: '#fff' }]}>{inv.description ?? 'Invoice'}</Text>
                    {inv.dueDate && (
                      <Text style={[t.caption, { color: 'rgba(255,255,255,0.6)', marginTop: 2 }]}>
                        Due {fmtDate(inv.dueDate)}
                      </Text>
                    )}
                  </View>
                  <Text style={[t.bodyBold, { color: '#fff' }]}>{fmtHkd(inv.amount)}</Text>
                </View>
              ))}

              <Button
                label={data.savedCard
                  ? `Pay Now — ···· ${data.savedCard.summary}`
                  : 'Add Card to Pay'}
                icon={data.savedCard ? 'card-outline' : 'add-circle-outline'}
                variant="ghost"
                loading={paying}
                onPress={data.savedCard ? handlePayNow : () => router.push('/payment/update-card')}
                style={s.payBtn}
              />
            </View>
          ) : (
            <View style={s.clearRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[t.label, { color: colors.success }]}>No outstanding balance</Text>
            </View>
          )}

          {/* ── Day pass (no membership) ── */}
          {data && !data.hasMembership && (
            <Card onPress={handleDayPass} rounded="lg" style={s.dayPassCard}>
              <View style={{ flex: 1 }}>
                <Text style={[t.bodyBold, { color: colors.amber }]}>No active membership</Text>
                <Text style={[t.bodySm, { color: colors.amber, marginTop: 2 }]}>
                  Buy a day pass to enter GO24 today
                </Text>
              </View>
              <View style={s.dayPassPrice}>
                <Text style={[t.btnMd, { color: '#fff' }]}>HK$150</Text>
              </View>
            </Card>
          )}

          {/* ── Account details ── */}
          <Card rounded="lg" padding={spacing.base} style={s.detailsSection}>
            <SectionHeader title="Account Details" style={{ marginBottom: spacing.md }} />
            <ListRow icon="mail-outline" iconColor={colors.textMuted} iconBg={colors.bg}
              label="Email" value={data?.member.email ?? '—'} showChevron={false} />
            <ListRow icon="call-outline" iconColor={colors.textMuted} iconBg={colors.bg}
              label="Phone" value={data?.member.phone ?? '—'} showChevron={false} divider={false} />
          </Card>

          {/* ── Saved card ── */}
          <Card rounded="lg" padding={spacing.base} onPress={() => router.push('/payment/update-card')}>
            <ListRow
              icon="card-outline"
              iconColor={data?.savedCard ? colors.primary : colors.textMuted}
              iconBg={data?.savedCard ? colors.primaryBg : colors.bg}
              label={data?.savedCard
                ? `${data.savedCard.brand?.toUpperCase() ?? 'CARD'} ···· ${data.savedCard.summary}`
                : 'No card saved'}
              sublabel={data?.savedCard?.expiryMonth
                ? `Exp ${data.savedCard.expiryMonth}/${data.savedCard.expiryYear}`
                : 'Tap to add a payment card'}
              divider={false}
            />
          </Card>

          {/* ── Navigation links ── */}
          <Card rounded="xl" padding={0} style={s.linksCard}>
            {LINKS.map((l, i) => (
              <ListRow
                key={l.label}
                icon={l.icon}
                iconColor={l.color}
                iconBg={l.bg}
                label={l.label}
                onPress={() => router.push(l.to as any)}
                divider={i < LINKS.length - 1}
                style={s.linkRow}
              />
            ))}
          </Card>

          {/* ── Logout — spatially separated (P9 destructive-nav-separation) ── */}
          <Pressable style={s.logoutRow} onPress={logout} hitSlop={8}>
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
            <Text style={[t.label, { color: colors.error }]}>Log Out</Text>
          </Pressable>

        </ScrollView>
      )}
    </ScreenWrapper>
  );
}

const s = StyleSheet.create({
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:      { padding: spacing.base, paddingBottom: spacing['3xl'], gap: spacing.md },

  profileCard: { alignItems: 'center', paddingVertical: spacing.xl },

  balanceCard: {
    backgroundColor: colors.primary, borderRadius: radius.xl,
    padding: spacing.lg, gap: spacing.sm, ...shadows.card,
  },
  balanceTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  invoiceRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
  },
  payBtn:     { backgroundColor: '#fff', borderRadius: radius.md, marginTop: spacing.xs },

  clearRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.success + '15', borderRadius: radius.md,
    paddingHorizontal: spacing.base, paddingVertical: spacing.md,
  },

  dayPassCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.amberBg },
  dayPassPrice: { backgroundColor: colors.amber, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },

  detailsSection: { gap: 0 },

  linksCard: { overflow: 'hidden' },
  linkRow:   { paddingHorizontal: spacing.base },

  logoutRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.base, marginTop: spacing.sm,
  },
});
