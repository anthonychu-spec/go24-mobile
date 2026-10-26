import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { colors, fonts } from '../theme';

/** Full-screen block: app too old, or brand in maintenance (with Retry). */
export function AppStatusScreen({ title, body, onRetry }: {
  title: string; body: string; onRetry?: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function retry() {
    if (!onRetry || busy) return;
    setBusy(true);
    try { await onRetry(); } finally { setBusy(false); }
  }

  return (
    <View style={s.root}>
      <Text style={s.title}>{title}</Text>
      <Text style={s.body}>{body}</Text>
      {onRetry && (
        <Pressable style={[s.btn, busy && { opacity: 0.7 }]} onPress={retry} disabled={busy}>
          {busy
            ? <ActivityIndicator color={colors.card} />
            : <Text style={s.btnTxt}>{t.appStatus.retry}</Text>}
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title:  { fontSize: 22, fontFamily: fonts.black, color: colors.text, textAlign: 'center', marginBottom: 12 },
  body:   { fontSize: 15, fontFamily: fonts.regular, color: colors.textSecond, textAlign: 'center', lineHeight: 22 },
  btn:    { marginTop: 28, minWidth: 160, height: 48, borderRadius: 24, backgroundColor: colors.primary,
            alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  btnTxt: { fontSize: 15, fontFamily: fonts.bold, color: colors.card },
});
