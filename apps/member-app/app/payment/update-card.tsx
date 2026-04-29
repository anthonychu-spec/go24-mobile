import { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator, Alert, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
// @adyen/react-native requires a custom dev build (EAS Build) — not available in Expo Go
// Run: eas build --profile development --platform ios (or android)
import AdyenCheckout from '@adyen/react-native';
import { apiClient } from '../../src/api/client';
import { colors } from '../../src/theme/colors';

interface CardSession {
  sessionId: string;
  sessionData: string;
  clientKey: string;
  environment: string;
}

export default function UpdateCardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<CardSession | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiClient.post<CardSession>('/payments/card-session', {})
      .then(r => setSession(r.data))
      .catch(() => setError('Failed to connect to payment service'))
      .finally(() => setLoading(false));
  }, []);

  const handleComplete = useCallback((result: any) => {
    if (result?.resultCode === 'Authorised' || result?.resultCode === 'Pending') {
      setSuccess(true);
    } else {
      Alert.alert('Card Update Failed', 'Please try again or use a different card.');
    }
  }, []);

  const handleError = useCallback((error: any) => {
    if (error?.message !== 'Cancelled') {
      Alert.alert('Error', error?.message ?? 'Something went wrong');
    }
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={s.hint}>Connecting to payment service…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (success) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Text style={s.successIcon}>✅</Text>
          <Text style={s.successTitle}>Card Updated!</Text>
          <Text style={s.successSub}>Your new card has been saved securely.</Text>
          <Pressable style={s.btn} onPress={() => router.back()}>
            <Text style={s.btnText}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !session) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Text style={s.errorText}>{error || 'Something went wrong'}</Text>
          <Pressable style={s.btn} onPress={() => router.back()}>
            <Text style={s.btnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </Pressable>
        <Text style={s.title}>Update Credit Card</Text>
        <Text style={s.subtitle}>Secured by Adyen</Text>
      </View>

      <AdyenCheckout
        session={{ id: session.sessionId, sessionData: session.sessionData }}
        clientKey={session.clientKey}
        environment={session.environment.toLowerCase() as 'test' | 'live'}
        onComplete={handleComplete}
        onError={handleError}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  header:       { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  back:         { marginBottom: 8 },
  backText:     { color: colors.primary, fontSize: 15 },
  title:        { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle:     { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  hint:         { color: colors.textMuted, marginTop: 12 },
  errorText:    { color: colors.error, fontSize: 15, textAlign: 'center' },
  successIcon:  { fontSize: 52 },
  successTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  successSub:   { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  btn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingHorizontal: 32, paddingVertical: 14, marginTop: 8,
  },
  btnText: { color: colors.bg, fontWeight: '700', fontSize: 16 },
});
