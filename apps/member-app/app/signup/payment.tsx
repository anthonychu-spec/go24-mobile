import { useCallback, useEffect, useState, Platform } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { publicClient } from '../../src/api/public';
import { tokenStorage } from '../../src/auth/storage';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import { useSignup } from './_layout';

export default function SignupStep4() {
  const router  = useRouter();
  const { data } = useSignup();
  const [session, setSession]   = useState<{ sessionId: string; sessionData: string; clientKey: string; environment: string } | null>(null);
  const [AdyenCheckout, setAdyenCheckout] = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [paying, setPaying]     = useState(false);
  const [error, setError]       = useState('');

  // Lazy-load Adyen on native only
  useEffect(() => {
    if (Platform.OS !== 'web') {
      import('@adyen/react-native').then(m => setAdyenCheckout(() => m.AdyenCheckout)).catch(() => {});
    }
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const { data: s } = await publicClient.post('/public/signup/session', {
        planId:       data.planId,
        amountHkd:    data.planPriceHkd,
        shopperEmail: data.email,
      });
      setSession(s);
    } catch {
      setError('Could not initialise payment. Please go back and try again.');
    } finally { setLoading(false); }
  }, [data.planId, data.planPriceHkd, data.email]);

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
        planId:            data.planId,
        facePhotoB64:      data.facePhotoB64,
        adyenPspReference: pspReference,
      });
      // Store tokens → navigate to home
      await tokenStorage.setTokens(result.accessToken, result.refreshToken);
      router.replace('/(tabs)' as any);
    } catch {
      Alert.alert(
        'Setup Error',
        'Payment was received but account setup failed. Please contact staff with your email address.',
      );
    } finally { setPaying(false); }
  };

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
    </SafeAreaView>
  );

  // Web fallback — Adyen Drop-In requires native
  if (Platform.OS === 'web') return (
    <SafeAreaView style={s.safe}>
      <View style={s.scroll}>
        <View style={s.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}><Text style={s.back}>← Back</Text></Pressable>
          <Text style={s.step}>Step 4 of 4</Text>
        </View>
        <Text style={s.title}>Payment</Text>
        <View style={s.webNotice}>
          <Ionicons name="phone-portrait-outline" size={48} color={colors.primary} />
          <Text style={s.webTitle}>Complete on Mobile App</Text>
          <Text style={s.webSub}>
            Payment processing requires the GO24 mobile app.{'\n'}
            Please download and complete signup there.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.scroll}>
        <View style={s.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}><Text style={s.back}>← Back</Text></Pressable>
          <Text style={s.step}>Step 4 of 4</Text>
        </View>
        <Text style={s.title}>Payment</Text>

        {/* Summary */}
        <View style={s.summary}>
          <Text style={s.summaryPlan}>{data.planName}</Text>
          <Text style={s.summaryPrice}>HK${data.planPriceHkd}</Text>
          <Text style={s.summaryNote}>/month · First month charged now</Text>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {/* Adyen Drop-In */}
        {session && AdyenCheckout && (
          <AdyenCheckout
            session={session}
            onComplete={(result: any) => {
              if (result.resultCode === 'Authorised') {
                completeSignup(result.sessionResult ?? session.sessionId);
              } else {
                setError(`Payment declined (${result.resultCode}). Please try again.`);
              }
            }}
            onError={(e: any) => setError(e?.message ?? 'Payment failed. Please try again.')}
          />
        )}

        {paying && (
          <View style={s.payingOverlay}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={s.payingText}>Setting up your account…</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bg },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:  { flex: 1, padding: 20 },
  topRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  back:    { fontSize: 14, color: colors.primary, fontFamily: fonts.semibold },
  step:    { fontSize: 12, color: colors.textMuted },
  title:   { fontSize: 26, fontFamily: fonts.black, color: colors.text, marginBottom: 20 },
  summary: { backgroundColor: colors.card, borderRadius: 16, padding: 18, gap: 4, marginBottom: 24 },
  summaryPlan: { fontSize: 14, color: colors.textMuted, fontFamily: fonts.regular },
  summaryPrice:{ fontSize: 28, fontFamily: fonts.black, color: colors.primary },
  summaryNote: { fontSize: 12, color: colors.textMuted },
  error:   { color: colors.error, fontFamily: fonts.regular, fontSize: 13, marginBottom: 16 },
  payingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  payingText: { fontSize: 15, fontFamily: fonts.semibold, color: colors.text },
  webNotice:  { alignItems: 'center', gap: 16, paddingTop: 60 },
  webTitle:   { fontSize: 20, fontFamily: fonts.bold, color: colors.text },
  webSub:     { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
