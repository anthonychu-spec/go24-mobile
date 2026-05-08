import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable,
  StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiClient } from '../../src/api/client';
import { colors } from '../../src/theme/colors';

export default function PtSignScreen() {
  const router = useRouter();
  const { sessionId, trainerId, agreementId } = useLocalSearchParams<{
    sessionId: string;
    trainerId?: string;
    agreementId?: string;
  }>();

  const sigRef = useRef<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [SignatureCanvas, setSignatureCanvas] = useState<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      import('react-native-signature-canvas')
        .then(mod => setSignatureCanvas(() => mod.default))
        .catch(() => {});
    }
  }, []);

  const handleSignature = async (sig: string) => {
    if (!sig || submitting) return;
    setSubmitting(true);
    try {
      await apiClient.post('/pt/sessions/verify', {
        pgmSessionId: sessionId,
        pgmTrainerId: trainerId ? Number(trainerId) : undefined,
        agreementId: agreementId ? Number(agreementId) : undefined,
        signature: sig,
      });
      setSuccess(true);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to submit signature');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Text style={s.successIcon}>✅</Text>
          <Text style={s.successTitle}>PT Session Confirmed!</Text>
          <Text style={s.successSub}>Your signature has been recorded.</Text>
          <Pressable style={s.doneBtn} onPress={() => router.back()}>
            <Text style={s.doneBtnText}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Text style={s.icon}>✍️</Text>
          <Text style={s.successTitle}>PT Sign-off</Text>
          <Text style={s.successSub}>Please use the mobile app to sign and confirm your PT session.</Text>
          <Pressable style={s.doneBtn} onPress={() => router.back()}>
            <Text style={s.doneBtnText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!SignatureCanvas) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </Pressable>
        <Text style={s.title}>Sign to Confirm PT</Text>
        <Text style={s.subtitle}>Session #{sessionId}</Text>
      </View>

      <View style={s.instructions}>
        <Text style={s.instructText}>請喺下方用手指簽名確認完成此 PT 堂</Text>
      </View>

      <View style={s.canvasWrapper}>
        <SignatureCanvas
          ref={sigRef}
          onOK={handleSignature}
          descriptionText=""
          clearText="清除"
          confirmText="確認簽名"
          backgroundColor="#2A2A2A"
          penColor={colors.primary}
          minWidth={2}
          maxWidth={4}
        />
      </View>

      {submitting && (
        <View style={s.overlay}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={s.overlayText}>Submitting…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  header:       { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  back:         { marginBottom: 8 },
  backText:     { color: colors.primary, fontSize: 15 },
  title:        { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle:     { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  instructions: { paddingHorizontal: 20, paddingBottom: 12 },
  instructText: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  canvasWrapper: { flex: 1, marginHorizontal: 16, marginBottom: 16 },
  icon:         { fontSize: 52 },
  successIcon:  { fontSize: 64 },
  successTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  successSub:   { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  doneBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingHorizontal: 40, paddingVertical: 14, marginTop: 8,
  },
  doneBtnText:  { color: colors.bg, fontWeight: '700', fontSize: 16 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  overlayText:  { color: colors.text, fontSize: 15 },
});
