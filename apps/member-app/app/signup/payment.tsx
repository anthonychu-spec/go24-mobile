import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { publicClient } from '../../src/api/public';
import { tokenStorage } from '../../src/auth/storage';
import { colors, fonts, spacing, type as ty, radius } from '../../src/theme';
import { Button, Card, ScreenWrapper, ScreenHeader } from '../../src/components';
import { t } from '../../src/i18n';
import { useSignup } from './_layout';

export default function SignupStep4() {
  const router  = useRouter();
  const { data } = useSignup();
  const [session, setSession]   = useState<{ sessionId: string; sessionData: string; clientKey: string; environment: string } | null>(null);
  const [AdyenCheckout, setAdyenCheckout] = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [paying, setPaying]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (Platform.OS !== 'web') {
      import('@adyen/react-native').then(m => setAdyenCheckout(() => m.AdyenCheckout)).catch(() => {});
    }
  }, []);

  const totalAmount = data.planPriceHkd + (data.joiningFee ?? 0) + (data.adminFee ?? 0);

  const loadSession = useCallback(async () => {
    try {
      const { data: s } = await publicClient.post('/public/signup/session', {
        planId:       data.planId,
        amountHkd:    totalAmount,
        shopperEmail: data.email,
      });
      setSession(s);
    } catch {
      setError(t.signup.paymentInitError);
    } finally { setLoading(false); }
  }, [data.planId, totalAmount, data.email]);

  useEffect(() => { loadSession(); }, [loadSession]);

  const completeSignup = async (pspReference: string) => {
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
        amountHkd:         totalAmount,
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
      <ScreenHeader showBack title={t.signup.step4Title} rightLabel="4/4" />
      <View style={s.webNotice}>
        <Ionicons name="phone-portrait-outline" size={48} color={colors.primary} />
        <Text style={s.webTitle}>{t.signup.completeOnMobile}</Text>
        <Text style={s.webSub}>{t.signup.completeOnMobileSub}</Text>
      </View>
    </ScreenWrapper>
  );

  return (
    <ScreenWrapper>
      <ScreenHeader showBack title={t.signup.step4Title} rightLabel="4/4" />

      <View style={s.content}>
        <Card style={s.summary}>
          <Text style={s.summaryPlan}>{data.planName}</Text>
          <Text style={s.summaryPrice}>HK${totalAmount}</Text>
          <Text style={s.summaryNote}>{t.signup.firstMonth}</Text>
          {(data.joiningFee > 0 || data.adminFee > 0) && (
            <View style={s.summaryBreakdown}>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Membership</Text>
                <Text style={s.summaryVal}>HK${data.planPriceHkd}</Text>
              </View>
              {data.joiningFee > 0 && (
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>{t.signup.joiningFee}</Text>
                  <Text style={s.summaryVal}>HK${data.joiningFee}</Text>
                </View>
              )}
              {data.adminFee > 0 && (
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>{t.signup.adminFee}</Text>
                  <Text style={s.summaryVal}>HK${data.adminFee}</Text>
                </View>
              )}
            </View>
          )}
        </Card>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {session && AdyenCheckout && (
          <AdyenCheckout
            session={session}
            onComplete={(result: any) => {
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

  summary:          { gap: spacing.xs, marginBottom: spacing.xl },
  summaryPlan:      { ...ty.bodySm, color: colors.textMuted },
  summaryPrice:     { fontSize: 28, fontFamily: fonts.black, color: colors.primary },
  summaryNote:      { ...ty.caption, color: colors.textMuted },
  summaryBreakdown: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: spacing.xs },
  summaryRow:       { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel:     { ...ty.bodySm, color: colors.textMuted },
  summaryVal:       { ...ty.bodySm, color: colors.textSecond, fontFamily: fonts.semibold },

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
