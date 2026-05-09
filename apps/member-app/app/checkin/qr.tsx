import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, View, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../src/api/client';
import { colors } from '../../src/theme/colors';

// react-native-qrcode-svg + react-native-svg require native build
// Lazy load to avoid web crash
let QRCode: any = null;

interface QrData {
  payload: string;
  userId: string;
  pgmId: number;
  expiresAt: string;
}

const QR_TTL_MS = 30_000;

export default function QrCheckinScreen() {
  const router = useRouter();
  const [qr, setQr] = useState<QrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [QRComponent, setQRComponent] = useState<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lazy load QR on native only
  useEffect(() => {
    if (Platform.OS !== 'web') {
      import('react-native-qrcode-svg')
        .then(mod => setQRComponent(() => mod.default))
        .catch(() => {});
    }
  }, []);

  const fetchQr = useCallback(async () => {
    try {
      const { data } = await apiClient.get<QrData>('/checkin/qr');
      setQr(data);
      setSecondsLeft(30);
      setError('');
    } catch {
      setError('Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQr();

    // Auto-refresh every 30s
    timerRef.current = setInterval(fetchQr, QR_TTL_MS);

    // Countdown every second
    countdownRef.current = setInterval(() => {
      setSecondsLeft(s => (s <= 1 ? 30 : s - 1));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [fetchQr]);

  const handleRefresh = () => {
    setLoading(true);
    fetchQr();
    // Reset auto-refresh timer
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(fetchQr, QR_TTL_MS);
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={s.headerTitle}>QR Check-in</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={s.body}>
        {/* Instruction */}
        <Text style={s.label}>Show this QR code to staff at the entrance</Text>

        {/* QR card */}
        <View style={s.qrCard}>
          {loading ? (
            <View style={s.qrPlaceholder}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : error ? (
            <View style={s.qrPlaceholder}>
              <Ionicons name="wifi-outline" size={48} color={colors.textMuted} />
              <Text style={s.errorText}>{error}</Text>
              <Pressable style={s.retryBtn} onPress={handleRefresh}>
                <Text style={s.retryText}>Try Again</Text>
              </Pressable>
            </View>
          ) : Platform.OS === 'web' ? (
            // Web fallback — show payload text (QR SVG needs native)
            <View style={s.webFallback}>
              <Ionicons name="qr-code-outline" size={64} color={colors.primary} />
              <Text style={s.webFallbackTitle}>QR Check-in</Text>
              <Text style={s.webFallbackSub}>Available on mobile app</Text>
              <Text style={s.webPayload} selectable numberOfLines={3}>
                {qr?.payload?.slice(0, 40)}…
              </Text>
            </View>
          ) : QRComponent ? (
            <View style={s.qrWrapper}>
              <QRComponent
                value={qr?.payload ?? ''}
                size={220}
                backgroundColor="#FFFFFF"
                color={colors.text}
                logo={undefined}
              />
            </View>
          ) : (
            <View style={s.qrPlaceholder}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          )}

          {/* Member info strip */}
          {qr && !error && (
            <View style={s.memberStrip}>
              <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
              <Text style={s.memberText}>Member #{qr.pgmId}</Text>
            </View>
          )}
        </View>

        {/* Countdown */}
        <View style={s.countdownRow}>
          <View style={[s.countdownBar, { width: `${(secondsLeft / 30) * 100}%` as any }]} />
          <Text style={s.countdownText}>
            Refreshes in {secondsLeft}s
          </Text>
        </View>

        {/* Manual refresh */}
        <Pressable style={s.refreshBtn} onPress={handleRefresh} disabled={loading}>
          <Ionicons name="refresh" size={16} color={colors.primary} />
          <Text style={s.refreshText}>Refresh Now</Text>
        </Pressable>

        {/* Security note */}
        <Text style={s.secNote}>
          🔒  This code is unique to your account and expires every 30 seconds
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },

  body:    { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 32, gap: 20 },
  label:   { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  qrCard: {
    backgroundColor: colors.card, borderRadius: 24,
    padding: 24, alignItems: 'center', gap: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 8,
    width: '100%', maxWidth: 320,
  },
  qrPlaceholder: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center', gap: 12 },
  qrWrapper:    { padding: 8, backgroundColor: '#FFFFFF', borderRadius: 12 },

  webFallback:      { alignItems: 'center', gap: 8, paddingVertical: 20 },
  webFallbackTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  webFallbackSub:   { fontSize: 13, color: colors.textMuted },
  webPayload:       { fontSize: 10, color: colors.textMuted, textAlign: 'center', marginTop: 8 },

  memberStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 16, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: colors.border, width: '100%', justifyContent: 'center',
  },
  memberText:   { fontSize: 14, fontWeight: '600', color: colors.text },

  countdownRow: {
    width: '100%', maxWidth: 320,
    backgroundColor: colors.border, borderRadius: 4, height: 4, overflow: 'hidden',
  },
  countdownBar: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  countdownText: {
    fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 6,
  },

  errorText: { fontSize: 14, color: colors.error, textAlign: 'center' },
  retryBtn:  { marginTop: 8, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: colors.primary, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.primary, borderRadius: 20,
  },
  refreshText: { color: colors.primary, fontWeight: '600', fontSize: 14 },

  secNote: {
    fontSize: 12, color: colors.textMuted, textAlign: 'center',
    lineHeight: 18, paddingHorizontal: 8,
  },
});
