import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { apiClient } from '../../src/api/client';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';

interface AccessInfo {
  outstanding: number;
  cardExpired: boolean;
  cardBrand: string | null;
  cardSummary: string | null;
}

function fmtHkd(n: number) {
  return `HK$${n.toLocaleString('en-HK', { minimumFractionDigits: 2 })}`;
}

export default function AccessBlockedScreen() {
  const router = useRouter();
  const [info, setInfo]       = useState<AccessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying]   = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    try {
      const [dashRes, cardRes] = await Promise.allSettled([
        apiClient.get<any>('/me/dashboard'),
        apiClient.get<any>('/payments/card'),
      ]);
      const dash = dashRes.status === 'fulfilled' ? dashRes.value.data : null;
      const card = cardRes.status === 'fulfilled' ? cardRes.value.data : null;

      const outstanding = dash?.membership?.outstandingBalance ?? 0;
      const cardExpired = dash?.savedCardExpired ?? false;

      setInfo({
        outstanding,
        cardExpired,
        cardBrand:   card?.cardBrand   ?? null,
        cardSummary: card?.cardSummary ?? null,
      });
    } catch {
      setError('Unable to load account info. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pay = useCallback(async () => {
    if (!info || info.outstanding <= 0) return;
    setPaying(true);
    setError('');
    try {
      const res = await apiClient.post<{ success: boolean; resultCode: string; amountCharged: number }>(
        '/me/pay-outstanding', {},
      );
      if (res.data.success) {
        setSuccess(true);
      } else {
        setError(`Payment declined (${res.data.resultCode}). Please update your card and try again.`);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
  }, [info]);

  // ── Success ──────────────────────────────────────────────────────────────
  if (success) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <View style={s.successCircle}>
            <Ionicons name="checkmark" size={44} color="#fff" />
          </View>
          <Text style={s.successTitle}>Access Restored!</Text>
          <Text style={s.successSub}>
            Your balance has been cleared. You can now enter GO24 — just scan your QR code at the gate.
          </Text>
          <Pressable style={s.btn} onPress={() => router.replace('/(tabs)')}>
            <Text style={s.btnTxt}>Back to Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const hasDebt     = (info?.outstanding ?? 0) > 0;
  const cardExpired = info?.cardExpired ?? false;
  const canPayNow   = hasDebt && !cardExpired;

  // ── Main ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      {/* Back */}
      <Pressable style={s.back} onPress={() => router.back()} hitSlop={10}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
        <Text style={s.backTxt}>Back</Text>
      </Pressable>

      <View style={s.body}>
        {/* Icon */}
        <View style={s.iconWrap}>
          <Ionicons name="ban" size={48} color={colors.primary} />
        </View>

        {/* Heading */}
        <Text style={s.heading}>Access Blocked</Text>
        <Text style={s.sub}>
          We detected that you were unable to enter GO24.{'\n'}
          Resolve the issue below to restore your access instantly.
        </Text>

        {/* Issue cards */}
        {cardExpired && (
          <View style={[s.issueCard, s.issueRed]}>
            <Ionicons name="card" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={s.issueTitle}>Credit Card Expired</Text>
              <Text style={s.issueSub}>
                {info?.cardBrand && info?.cardSummary
                  ? `${info.cardBrand} ${info.cardSummary} has expired.`
                  : 'Your saved card has expired.'}
                {' '}Update it to enable payments.
              </Text>
            </View>
          </View>
        )}

        {hasDebt && (
          <View style={[s.issueCard, s.issueRed]}>
            <Ionicons name="receipt" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={s.issueTitle}>Outstanding Balance</Text>
              <Text style={s.issueSub}>
                You owe {fmtHkd(info!.outstanding)}. Clear this to regain entry.
              </Text>
            </View>
          </View>
        )}

        {!hasDebt && !cardExpired && (
          <View style={[s.issueCard, { borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={s.issueTitle}>No Outstanding Issues Found</Text>
              <Text style={s.issueSub}>
                Your account looks clear. If you're still having trouble entering, please speak to staff.
              </Text>
            </View>
          </View>
        )}

        {/* Error */}
        {error !== '' && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
            <Text style={s.errorTxt}>{error}</Text>
          </View>
        )}

        {/* Actions */}
        {cardExpired && (
          <Pressable style={s.btn} onPress={() => router.push('/payment/update-card')}>
            <Ionicons name="card-outline" size={18} color="#fff" />
            <Text style={s.btnTxt}>Update Credit Card</Text>
          </Pressable>
        )}

        {canPayNow && (
          <Pressable style={s.btn} onPress={pay} disabled={paying}>
            {paying
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Ionicons name="flash" size={18} color="#fff" />
                  <Text style={s.btnTxt}>Pay {fmtHkd(info!.outstanding)} Now</Text>
                </>
            }
          </Pressable>
        )}

        {hasDebt && cardExpired && (
          <Text style={s.note}>
            Update your card first, then return here to pay the outstanding balance.
          </Text>
        )}

        <Pressable style={s.ghostBtn} onPress={() => router.back()}>
          <Text style={s.ghostTxt}>Speak to Staff Instead</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.bg },
  back:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingTop: 12 },
  backTxt: { fontSize: 15, fontFamily: fonts.regular, color: colors.text },

  body:  { flex: 1, paddingHorizontal: 24, paddingTop: 32, gap: 16 },

  iconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.primaryBg,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 4,
  },
  heading: { fontSize: 28, fontFamily: fonts.black, color: colors.text, textAlign: 'center' },
  sub:     { fontSize: 14, fontFamily: fonts.regular, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },

  issueCard: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: colors.card, borderRadius: 16,
    padding: 16, borderWidth: 1.5,
  },
  issueRed:   { borderColor: colors.primary + '40' },
  issueTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.text, marginBottom: 3 },
  issueSub:   { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted, lineHeight: 18 },

  errorBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#FFF5F5', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: colors.error + '30',
  },
  errorTxt: { flex: 1, fontSize: 13, fontFamily: fonts.regular, color: colors.error },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 24,
  },
  btnTxt: { fontSize: 16, fontFamily: fonts.bold, color: '#fff' },

  ghostBtn: { alignItems: 'center', paddingVertical: 12 },
  ghostTxt: { fontSize: 14, fontFamily: fonts.regular, color: colors.textMuted },

  note: { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted, textAlign: 'center' },

  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 },
  successCircle:{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 26, fontFamily: fonts.black, color: colors.text },
  successSub:   { fontSize: 14, fontFamily: fonts.regular, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
