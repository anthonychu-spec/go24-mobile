import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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

  useEffect(() => {
    apiClient.post<CardSession>('/payments/card-session', {})
      .then(r => setSession(r.data))
      .catch(() => setError('Failed to start card update'))
      .finally(() => setLoading(false));
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

  // Adyen Drop-in requires the native @adyen/adyen-react-native SDK.
  // When the SDK is installed, replace this placeholder with:
  //
  //   import AdyenCheckout from '@adyen/adyen-react-native';
  //   <AdyenCheckout
  //     session={{ id: session.sessionId, sessionData: session.sessionData }}
  //     clientKey={session.clientKey}
  //     environment={session.environment}
  //     onComplete={onComplete}
  //     onError={onError}
  //   />

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </Pressable>
        <Text style={s.title}>Update Credit Card</Text>
      </View>

      <View style={s.body}>
        <View style={s.infoCard}>
          <Text style={s.infoIcon}>💳</Text>
          <Text style={s.infoTitle}>Secure Card Update</Text>
          <Text style={s.infoDesc}>
            Your card details are encrypted and processed directly by Adyen.
            We only store the last 4 digits for display.
          </Text>
        </View>

        {/* Session ready — Adyen SDK placeholder */}
        <View style={s.sdkPlaceholder}>
          <Text style={s.sdkNote}>
            Install <Text style={s.code}>@adyen/adyen-react-native</Text> to enable in-app card entry.
          </Text>
          <Text style={s.sessionId}>Session: {session.sessionId.slice(0, 16)}…</Text>
        </View>

        <Pressable
          style={s.btn}
          onPress={() => Alert.alert('Coming Soon', 'Install Adyen SDK to complete card update')}
        >
          <Text style={s.btnText}>Enter Card Details</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: colors.bg },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  header:   { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  back:     { marginBottom: 8 },
  backText: { color: colors.primary, fontSize: 15 },
  title:    { fontSize: 26, fontWeight: '800', color: colors.text },
  body:     { flex: 1, padding: 20, gap: 20 },
  infoCard: {
    backgroundColor: colors.card, borderRadius: 16, padding: 20,
    alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border,
  },
  infoIcon:  { fontSize: 36 },
  infoTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  infoDesc:  { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  sdkPlaceholder: {
    backgroundColor: colors.card, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: colors.border, gap: 6,
  },
  sdkNote:   { fontSize: 13, color: colors.textMuted },
  code:      { fontFamily: 'monospace', color: colors.primary },
  sessionId: { fontSize: 11, color: colors.textMuted },
  hint:      { color: colors.textMuted, marginTop: 12 },
  errorText: { color: colors.error, fontSize: 15, textAlign: 'center' },
  btn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  btnText: { color: colors.bg, fontWeight: '700', fontSize: 16 },
});
