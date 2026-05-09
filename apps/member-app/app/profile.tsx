import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../src/api/client';
import { colors } from '../src/theme/colors';
import { fonts } from '../src/theme/fonts';
import { useAuth } from '../src/auth/context';

interface ProfileData {
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

export default function ProfileScreen() {
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

  useEffect(() => { load(); }, [load]);

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

  const LINKS = [
    { icon: 'card-outline'          as const, label: 'My Memberships',      to: '/membership' },
    { icon: 'wallet-outline'        as const, label: 'Update Payment Card',  to: '/payment/update-card' },
    { icon: 'notifications-outline' as const, label: 'Notifications',        to: '/(tabs)/notifications' },
    { icon: 'qr-code-outline'       as const, label: 'QR Check-in',          to: '/checkin/qr' },
  ];

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={s.headerTitle}>My Account</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.border} />
          <Text style={s.errorText}>{error}</Text>
          <Pressable style={s.retryBtn} onPress={load}>
            <Text style={s.retryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Avatar + Name ── */}
          <View style={s.avatarCard}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{getInitials(data?.member.name ?? null)}</Text>
            </View>
            <Text style={s.memberName}>{data?.member.name ?? '—'}</Text>
            <Text style={s.memberId}>Member #{data?.member.pgmId}</Text>
            {data?.member.memberCode ? (
              <View style={s.codeChip}>
                <Text style={s.codeText}>{data.member.memberCode}</Text>
              </View>
            ) : null}
          </View>

          {/* ── Outstanding Balance (red card) ── */}
          {data && data.balance.outstanding > 0 ? (
            <View style={s.balanceCard}>
              <View style={s.balanceTop}>
                <View>
                  <Text style={s.balanceLabel}>Outstanding Balance</Text>
                  <Text style={s.balanceAmount}>{fmtHkd(data.balance.outstanding)}</Text>
                </View>
                <Ionicons name="alert-circle" size={32} color="rgba(255,255,255,0.8)" />
              </View>

              {/* Invoice list */}
              {data.balance.invoices.map(inv => (
                <View key={inv.id} style={s.invoiceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.invoiceDesc}>{inv.description ?? 'Invoice'}</Text>
                    {inv.dueDate ? (
                      <Text style={s.invDue}>Due {fmtDate(inv.dueDate)}</Text>
                    ) : null}
                  </View>
                  <Text style={s.invoiceAmt}>{fmtHkd(inv.amount)}</Text>
                </View>
              ))}

              {/* Pay Now button */}
              {data.savedCard ? (
                <Pressable
                  style={[s.payBtn, paying && s.payBtnDisabled]}
                  onPress={handlePayNow}
                  disabled={paying}
                >
                  {paying ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <>
                      <Ionicons name="card-outline" size={18} color={colors.primary} />
                      <Text style={s.payBtnText}>
                        Pay Now — ···· {data.savedCard.summary}
                      </Text>
                    </>
                  )}
                </Pressable>
              ) : (
                <Pressable style={s.payBtn} onPress={() => router.push('/payment/update-card')}>
                  <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                  <Text style={s.payBtnText}>Add Card to Pay</Text>
                </Pressable>
              )}
            </View>
          ) : (
            /* ── Clear balance ── */
            <View style={s.clearCard}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={s.clearText}>No outstanding balance</Text>
            </View>
          )}

          {/* ── Account Details ── */}
          <View style={s.detailsCard}>
            <Text style={s.detailsTitle}>ACCOUNT DETAILS</Text>
            {([
              { icon: 'mail-outline', label: 'Email', value: data?.member.email ?? '—' },
              { icon: 'call-outline', label: 'Phone', value: data?.member.phone ?? '—' },
            ] as const).map(item => (
              <View key={item.label} style={s.detailRow}>
                <Ionicons name={item.icon} size={16} color={colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={s.detailLabel}>{item.label}</Text>
                  <Text style={s.detailValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* ── Saved Card ── */}
          {data?.savedCard ? (
            <Pressable style={s.cardRow} onPress={() => router.push('/payment/update-card')}>
              <Ionicons name="card-outline" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.detailLabel}>Saved Card</Text>
                <Text style={s.detailValue}>
                  {data.savedCard.brand?.toUpperCase() ?? 'CARD'} ···· {data.savedCard.summary}
                  {data.savedCard.expiryMonth ? `  exp ${data.savedCard.expiryMonth}/${data.savedCard.expiryYear}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.border} />
            </Pressable>
          ) : (
            <Pressable style={s.cardRow} onPress={() => router.push('/payment/update-card')}>
              <Ionicons name="card-outline" size={20} color={colors.textMuted} />
              <Text style={[s.detailValue, { flex: 1, color: colors.textMuted }]}>No card saved</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.border} />
            </Pressable>
          )}

          {/* ── Links ── */}
          <View style={s.linksCard}>
            {LINKS.map((l, i) => (
              <Pressable
                key={l.label}
                style={[s.linkRow, i < LINKS.length - 1 && s.linkDivider]}
                onPress={() => router.push(l.to as any)}
              >
                <View style={s.linkIconBox}>
                  <Ionicons name={l.icon} size={18} color={colors.primary} />
                </View>
                <Text style={s.linkLabel}>{l.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.border} />
              </Pressable>
            ))}
          </View>

          {/* ── Logout ── */}
          <Pressable style={s.logoutBtn} onPress={logout}>
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
            <Text style={s.logoutText}>Log Out</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07,
  shadowRadius: 8,
  elevation: 3,
} as const;

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  scroll: { padding: 16, paddingBottom: 48, gap: 12 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: fonts.bold, color: colors.text },

  // Avatar card
  avatarCard: {
    backgroundColor: colors.card, borderRadius: 20,
    paddingVertical: 28, alignItems: 'center', gap: 6, ...SHADOW,
  },
  avatar: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  avatarText: { fontSize: 30, fontFamily: fonts.black, color: '#fff' },
  memberName: { fontSize: 20, fontFamily: fonts.bold, color: colors.text },
  memberId:   { fontSize: 13, fontFamily: fonts.regular, color: colors.textMuted },
  codeChip: {
    backgroundColor: colors.primary + '12', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 5, marginTop: 4,
  },
  codeText: { fontSize: 12, fontFamily: fonts.semibold, color: colors.primary },

  // Outstanding balance card (red)
  balanceCard: {
    backgroundColor: colors.primary, borderRadius: 18,
    padding: 20, gap: 10, ...SHADOW,
  },
  balanceTop:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  balanceLabel: { fontSize: 12, fontFamily: fonts.semibold, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.5 },
  balanceAmount:{ fontSize: 34, fontFamily: fonts.black, color: '#fff', marginTop: 2 },
  invoiceRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  invoiceDesc: { fontSize: 13, fontFamily: fonts.semibold, color: '#fff' },
  invDue:      { fontSize: 11, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  invoiceAmt:  { fontSize: 14, fontFamily: fonts.black, color: '#fff' },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12,
    paddingVertical: 15, paddingHorizontal: 20, marginTop: 4,
  },
  payBtnDisabled: { opacity: 0.6 },
  payBtnText: { fontSize: 15, fontFamily: fonts.bold, color: colors.primary },

  // Clear balance
  clearCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.success + '15', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  clearText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.success },

  // Account details
  detailsCard: {
    backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 14, ...SHADOW,
  },
  detailsTitle: {
    fontSize: 11, fontFamily: fonts.bold, color: colors.textMuted,
    letterSpacing: 1.2, marginBottom: 2,
  },
  detailRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailLabel: { fontSize: 11, fontFamily: fonts.regular, color: colors.textMuted },
  detailValue: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text, marginTop: 2 },

  // Saved card row
  cardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderRadius: 14, padding: 16, ...SHADOW,
  },

  // Links
  linksCard: {
    backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden', ...SHADOW,
  },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 15,
  },
  linkDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  linkIconBox: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: colors.primary + '10',
    alignItems: 'center', justifyContent: 'center',
  },
  linkLabel: { flex: 1, fontSize: 15, fontFamily: fonts.regular, color: colors.text },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16,
  },
  logoutText: { fontSize: 15, fontFamily: fonts.semibold, color: colors.error },

  // Error
  errorText: { fontSize: 14, fontFamily: fonts.regular, color: colors.textMuted },
  retryBtn:  {
    borderWidth: 1, borderColor: colors.primary, borderRadius: 20,
    paddingHorizontal: 24, paddingVertical: 10,
  },
  retryText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.primary },
});
