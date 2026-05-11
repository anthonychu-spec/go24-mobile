import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { publicClient } from '../../src/api/public';
import { tokenStorage } from '../../src/auth/storage';
import { colors, fonts, spacing, type as ty, radius } from '../../src/theme';
import { Button, Card, ScreenWrapper, ScreenHeader } from '../../src/components';
import { t } from '../../src/i18n';
import { useSignup } from './_layout';

const TC_URL = 'https://go24fitness.com/terms';

/** Pro-rata: days remaining in start month (inclusive) / days in month */
function calcProRata(membershipFee: number, startDateISO: string): number {
  if (!startDateISO) return membershipFee;
  const d = new Date(startDateISO);
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const remaining = daysInMonth - d.getDate() + 1;
  return Math.round((membershipFee / daysInMonth) * remaining);
}

export default function SignupStep4() {
  const router  = useRouter();
  const { data } = useSignup();
  const [session, setSession]   = useState<{ sessionId: string; sessionData: string; clientKey: string; environment: string } | null>(null);
  const [AdyenCheckout, setAdyenCheckout] = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [paying, setPaying]     = useState(false);
  const [error, setError]       = useState('');
  const [tcAccepted, setTcAccepted] = useState(false);
  const [tcError, setTcError]   = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      import('@adyen/react-native').then(m => setAdyenCheckout(() => m.AdyenCheckout)).catch(() => {});
    }
  }, []);

  const isDayPass = data.planPriceHkd > 0 && data.planPriceHkd <= 300;

  // For day pass: no pro-rata, just the flat fee
  const proRata     = isDayPass ? data.planPriceHkd : calcProRata(data.planPriceHkd, data.startDate);
  const accessFee   = data.adminFee ?? 0;
  const totalToday  = proRata + accessFee + (data.joiningFee ?? 0);

  const loadSession = useCallback(async () => {
    try {
      const { data: s } = await publicClient.post('/public/signup/session', {
        planId:       data.planId,
        amountHkd:    totalToday,
        shopperEmail: data.email,
      });
      setSession(s);
    } catch {
      setError(t.signup.paymentInitError);
    } finally { setLoading(false); }
  }, [data.planId, totalToday, data.email]);

  useEffect(() => { loadSession(); }, [loadSession]);

  const completeSignup = async (pspReference: string) => {
    if (!tcAccepted) { setTcError(true); return; }
    setPaying(true);
    try {
      const { data: result } = await publicClient.post('/public/signup/complete', {
        firstName:         data.firstName,
        lastName:          data.lastName,
        email:             data.email,
        phone:             data.phone,
        dateOfBirth:       data.dateOfBirth,
        sex:               data.sex,
        address:           '',
        clubId:            data.clubId,
        planId:            data.planId,
        startDate:         data.startDate,
        amountHkd:         totalToday,
        facePhotoB64:      data.facePhotoB64,
        adyenPspReference: pspReference,
      });
      await tokenStorage.setTokens(result.accessToken, result.refreshToken);
      router.replace('/signup/success' as any);
    } catch {
      Alert.alert(t.signup.setupErrorTitle, t.signup.setupErrorMsg);
    } finally { setPaying(false); }
  };

  if (loading) return (
    <ScreenWrapper>
      <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
    </ScreenWrapper>
  );

  if (Platform.OS === 'web') return (
    <ScreenWrapper>
      <ScreenHeader showBack title={t.signup.step4Title} rightLabel="5/5" />
      <View style={s.webNotice}>
        <Ionicons name="phone-portrait-outline" size={48} color={colors.primary} />
        <Text style={s.webTitle}>{t.signup.completeOnMobile}</Text>
        <Text style={s.webSub}>{t.signup.completeOnMobileSub}</Text>
      </View>
    </ScreenWrapper>
  );

  return (
    <ScreenWrapper>
      <ScreenHeader showBack title={t.signup.step4Title} rightLabel="5/5" />

      <View style={s.content}>
        {/* Payment summary */}
        <Card style={s.summary}>
          <Text style={s.planName}>{data.planName}</Text>

          <View style={s.divider} />

          {/* Pro-rata row */}
          {!isDayPass && (
            <View style={s.row}>
              <View>
                <Text style={s.rowLabel}>{t.signup.proRataLabel}</Text>
                <Text style={s.rowSub}>{t.signup.proRataNote}</Text>
              </View>
              <Text style={s.rowVal}>HK${proRata}</Text>
            </View>
          )}

          {isDayPass && (
            <View style={s.row}>
              <Text style={s.rowLabel}>Day Pass</Text>
              <Text style={s.rowVal}>HK${data.planPriceHkd}</Text>
            </View>
          )}

          {accessFee > 0 && (
            <View style={s.row}>
              <Text style={s.rowLabel}>{t.signup.accessCodeFee}</Text>
              <Text style={s.rowVal}>HK${accessFee}</Text>
            </View>
          )}

          <View style={s.divider} />

          <View style={s.row}>
            <Text style={s.totalLabel}>{t.signup.totalToday}</Text>
            <Text style={s.totalVal}>HK${totalToday}</Text>
          </View>

          {!isDayPass && (
            <Text style={s.fromMonth2}>
              {t.signup.fromMonthTwo}: HK${data.planPriceHkd}/month
            </Text>
          )}
        </Card>

        {/* T&C */}
        <Pressable
          style={s.tcRow}
          onPress={() => { setTcAccepted(v => !v); setTcError(false); }}
        >
          <View style={[s.checkbox, tcAccepted && s.checkboxChecked]}>
            {tcAccepted && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={s.tcText}>
            {t.signup.termsAgree}
            <Text style={s.tcLink} onPress={() => Linking.openURL(TC_URL)}>
              {t.signup.termsLink}
            </Text>
          </Text>
        </Pressable>
        {tcError && <Text style={s.tcError}>{t.signup.termsMustAgree}</Text>}

        {error ? <Text style={s.error}>{error}</Text> : null}

        {session && AdyenCheckout && (
          <AdyenCheckout
            session={session}
            onComplete={(result: any) => {
              if (!tcAccepted) { setTcError(true); return; }
              if (result.resultCode === 'Authorised' || result.resultCode === 'Pending') {
                completeSignup(result.sessionResult ?? session.sessionId);
              } else {
                setError(`${t.signup.paymentDeclined} (${result.resultCode})`);
              }
            }}
            onError={(e: any) => setError(e?.message ?? t.signup.paymentFailed)}
          />
        )}

        {paying && (
          <View style={s.payingOverlay}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={s.payingText}>{t.signup.settingUpAccount}</Text>
          </View>
        )}
      </View>
    </ScreenWrapper>
  );
}

const s = StyleSheet.create({
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, padding: spacing.xl },

  summary:  { marginBottom: spacing.lg },
  planName: { ...ty.h4, color: colors.text, marginBottom: spacing.md },
  divider:  { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.sm },

  row:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: spacing.xs },
  rowLabel: { ...ty.body, color: colors.text },
  rowSub:   { ...ty.caption, color: colors.textMuted, marginTop: 2 },
  rowVal:   { ...ty.body, color: colors.textSecond, fontFamily: fonts.semibold },

  totalLabel: { ...ty.bodyBold, color: colors.text },
  totalVal:   { fontSize: 20, fontFamily: fonts.black, color: colors.primary },
  fromMonth2: { ...ty.caption, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'right' },

  tcRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: radius.sm,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  tcText: { ...ty.bodySm, color: colors.textSecond, flex: 1, lineHeight: 20 },
  tcLink: { color: colors.primary, textDecorationLine: 'underline' },
  tcError: { ...ty.caption, color: colors.error, marginBottom: spacing.sm },

  error:   { ...ty.body, color: colors.error, marginBottom: spacing.base },

  payingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center', gap: spacing.md,
  },
  payingText: { ...ty.bodyBold, color: colors.text },

  webNotice: { alignItems: 'center', gap: spacing.base, paddingTop: spacing['5xl'] },
  webTitle:  { ...ty.h3, color: colors.text },
  webSub:    { ...ty.body, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
