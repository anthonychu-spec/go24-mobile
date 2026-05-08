import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform,
  Pressable, StatusBar, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/context';
import { t } from '../../src/i18n';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';

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
  const [showPass, setShowPass] = useState(false);
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
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* Brand hero — deep red */}
      <View style={s.hero}>
        <SafeAreaView edges={['top']}>
          <View style={s.heroContent}>
            <View style={s.logoRow}>
              <View style={s.logoSymbol}>
                <Ionicons name="fitness" size={28} color="#fff" />
              </View>
              <View>
                <Text style={s.logoWordmark}>GO24</Text>
                <Text style={s.logoSub}>FITNESS</Text>
              </View>
            </View>
            <Text style={s.heroTagline}>Move. Train. Perform.</Text>
          </View>
        </SafeAreaView>
      </View>

      {/* Form panel — white */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.panel}>
        <Text style={s.panelTitle}>Welcome back</Text>
        <Text style={s.panelSub}>Sign in to your GO24 account</Text>

        <View style={s.fields}>
          {/* Email */}
          <View style={s.field}>
            <Text style={s.label}>{t.login.emailLabel}</Text>
            <View style={s.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={s.inputIcon} />
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder={t.login.emailPlaceholder}
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                editable={!submitting}
              />
            </View>
          </View>

          {/* Password */}
          <View style={s.field}>
            <Text style={s.label}>{t.login.passwordLabel}</Text>
            <View style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={s.inputIcon} />
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder={t.login.passwordPlaceholder}
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPass}
                autoComplete="current-password"
                editable={!submitting}
                onSubmitEditing={handleSubmit}
                returnKeyType="go"
              />
              <Pressable onPress={() => setShowPass(p => !p)} hitSlop={8}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>

          {error ? (
            <View style={s.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={[s.signInBtn, submitting && s.signInBtnOff]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.signInText}>{t.login.submit}</Text>
            }
          </Pressable>

          <Pressable style={s.forgotBtn}>
            <Text style={s.forgotText}>{t.login.forgotPassword}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.primary },

  hero:  { backgroundColor: colors.primary },
  heroContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  logoRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  logoSymbol: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoWordmark: { fontSize: 26, fontFamily: fonts.black, color: '#fff', letterSpacing: 3 },
  logoSub:      { fontSize: 9,  fontFamily: fonts.bold,  color: 'rgba(255,255,255,0.6)', letterSpacing: 3, marginTop: -2 },
  heroTagline:  { fontSize: 14, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 },

  panel: {
    flex: 1, backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingTop: 28,
  },
  panelTitle: { fontSize: 22, fontFamily: fonts.black, color: colors.text },
  panelSub:   { fontSize: 14, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 4, marginBottom: 24 },

  fields: { gap: 16 },
  field:  { gap: 6 },
  label:  { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    paddingHorizontal: 14, height: 50,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1, fontSize: 15, fontFamily: fonts.regular,
    color: colors.text, padding: 0,
  },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: { fontSize: 13, fontFamily: fonts.regular, color: colors.error },

  signInBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    height: 52, alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  signInBtnOff: { opacity: 0.7 },
  signInText:   { fontSize: 16, fontFamily: fonts.bold, color: '#fff', letterSpacing: 0.5 },

  forgotBtn:  { alignItems: 'center', paddingVertical: 8 },
  forgotText: { fontSize: 14, fontFamily: fonts.regular, color: colors.primary },
});
