import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { apiClient } from '../../../api/client';
import { apiErrorMessage } from '../../../api/errors';
import { brand } from '../../../brand';
import { colors } from '../../../theme';
import { Btn, Loading, Message, T } from '../../../ui/kit';

/** GET /checkin/qr (signed, short-lived; same shape app/checkin/qr.tsx uses) */
interface QrData {
  payload: string;
  userId: string;
  pgmId: number;
  expiresAt: string;
}

const SIZE = 210;
// Scanners need dark modules on true white whatever the brand palette, so these are fixed
const QR_LIGHT = 'white';
const QR_DARK = 'black';
const FALLBACK_TTL_MS = 30_000;

/** Fetch again a few seconds before the code expires (5s–60s) */
function refreshDelay(expiresAt: string | undefined): number {
  const left = expiresAt ? new Date(expiresAt).getTime() - Date.now() : NaN;
  if (Number.isNaN(left)) return FALLBACK_TTL_MS;
  return Math.min(60_000, Math.max(5_000, left - 3_000));
}

/** Member check-in QR (feature member_qr); renews itself while the pass is open */
export function MemberQr() {
  const [qr, setQr] = useState<QrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef(true);

  const load = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    setLoading(true);
    try {
      const { data } = await apiClient.get<QrData>('/checkin/qr');
      if (!live.current) return;
      setQr(data);
      setError(null);
      timer.current = setTimeout(() => { void load(); }, refreshDelay(data.expiresAt));
    } catch (err) {
      if (!live.current) return;
      setQr(null);
      setError(apiErrorMessage(err));
    } finally {
      if (live.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  if (error) {
    return (
      <View style={s.error}>
        <Message text={error} />
        <Btn label="Try again" kind="ghost" onPress={load} loading={loading} />
      </View>
    );
  }
  return (
    <View style={s.wrap}>
      <View style={s.panel} accessible accessibilityLabel="Member check-in QR code">
        {qr ? <QRCode value={qr.payload} size={SIZE} backgroundColor={QR_LIGHT} color={QR_DARK} ecl="M" /> : <Loading />}
      </View>
      <T v="micro" color={colors.textMuted} style={s.caption}>Show this code at the front desk</T>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: 22 },
  panel: {
    width: SIZE + 44, height: SIZE + 44, padding: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: QR_LIGHT, borderRadius: brand.shape.card,
  },
  caption: { marginTop: 12, textAlign: 'center' },
  error: { marginBottom: 16 },
});
