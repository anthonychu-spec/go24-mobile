import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform,
  Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/context';
import { t } from '../../src/i18n';
import { colors } from '../../src/theme/colors';

function mapError(err: unknown): string {
  const msg: string = (err as any)?.response?.data?.message ?? '';
  if (msg.includes('INVALID_CREDENTIALS') || msg.includes('invalid')) return t.errors.invalidCredentials;
  if (msg.includes('MEMBER_INACTIVE')) return t.errors.memberInactive;
  if (msg.includes('ACCOUNT_LOCKED') || msg.includes('locked')) return t.errors.accountLocked;
  if ((err as any)?.code === 'ECONNABORTED' || (err as any)?.code === 'ERR_NETWORK') return t.errors.networkError;
  return t.errors.unknown;
}

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError('');
    if (!email.trim() || !password) { setError(t.errors.invalidCredentials); return; }
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      setError(mapError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>
        <View style={s.inner}>
          <View style={s.header}>
            <Text style={s.logo}>GO24</Text>
            <Text style={s.title}>{t.login.title}</Text>
            <Text style={s.subtitle}>{t.login.subtitle}</Text>
          </View>
          <View style={s.form}>
            <View style={s.field}>
              <Text style={s.label}>{t.login.emailLabel}</Text>
              <TextInput
                style={s.input} value={email} onChangeText={setEmail}
                placeholder={t.login.emailPlaceholder} placeholderTextColor={colors.textMuted}
                keyboardType="email-address" autoCapitalize="none" autoComplete="email"
                autoCorrect={false} editable={!submitting}
              />
            </View>
            <View style={s.field}>
              <Text style={s.label}>{t.login.passwordLabel}</Text>
              <TextInput
                style={s.input} value={password} onChangeText={setPassword}
                placeholder={t.login.passwordPlaceholder} placeholderTextColor={colors.textMuted}
                secureTextEntry autoComplete="current-password" editable={!submitting}
                onSubmitEditing={handleSubmit} returnKeyType="go"
              />
            </View>
            {error ? <Text style={s.error}>{error}</Text> : null}
            <Pressable style={[s.btn, submitting && s.btnOff]} onPress={handleSubmit} disabled={submitting}>
              {submitting
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={s.btnText}>{t.login.submit}</Text>}
            </Pressable>
            <Pressable style={s.forgot}>
              <Text style={s.forgotText}>{t.login.forgotPassword}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  kav: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 40 },
  header: { alignItems: 'center', gap: 8 },
  logo: { fontSize: 42, fontWeight: '900', color: colors.primary, letterSpacing: 6 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  form: { gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, height: 52, paddingHorizontal: 16, fontSize: 16, color: colors.text,
  },
  error: { fontSize: 14, color: colors.error, textAlign: 'center' },
  btn: { backgroundColor: colors.primary, borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnOff: { opacity: 0.6 },
  btnText: { fontSize: 16, fontWeight: '700', color: colors.bg },
  forgot: { alignItems: 'center', paddingVertical: 8 },
  forgotText: { fontSize: 14, color: colors.textMuted },
});
