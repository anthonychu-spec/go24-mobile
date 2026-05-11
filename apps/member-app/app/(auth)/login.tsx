import { useState } from 'react';
import {
  Dimensions, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/context';
import { t } from '../../src/i18n';
import { colors, fonts, spacing, radius } from '../../src/theme';

const { width: W, height: H } = Dimensions.get('window');

function mapError(err: unknown): string {
  const data = (err as any)?.response?.data ?? {};
  const msg: string  = data.message ?? '';
  const code: string = data.code ?? '';
  if (code === 'MEMBER_INACTIVE'    || msg.includes('MEMBER_INACTIVE'))                    return t.errors.memberInactive;
  if (code === 'INVALID_CREDENTIALS'|| msg.includes('INVALID_CREDENTIALS') || msg.toLowerCase().includes('invalid')) return t.errors.invalidCredentials;
  if (code === 'ACCOUNT_LOCKED'     || msg.includes('ACCOUNT_LOCKED') || msg.includes('locked')) return t.errors.accountLocked;
  if ((err as any)?.code === 'ECONNABORTED' || (err as any)?.code === 'ERR_NETWORK')       return t.errors.networkError;
  return t.errors.unknown;
}

export default function LoginScreen() {
  const { login } = useAuth();
  const router    = useRouter();
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [error, setError]           = useState('');
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
      <StatusBar barStyle="light-content" backgroundColor="#0D0005" />

      {/* ── Full-screen atmospheric background ── */}
      <LinearGradient
        colors={['#0D0005', '#1A0008', '#2D000D', '#E8192C']}
        locations={[0, 0.35, 0.65, 1]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Geometric decoration — simulates depth/motion */}
      {/* Large ring */}
      <View style={s.ring1} />
      <View style={s.ring2} />
      {/* Solid accent circles */}
      <View style={s.blob1} />
      <View style={s.blob2} />
      {/* Diagonal lines */}
      <View style={[s.line, s.line1]} />
      <View style={[s.line, s.line2]} />
      <View style={[s.line, s.line3]} />

      {/* ── Brand section ── */}
      <SafeAreaView style={s.brandArea} edges={['top']}>
        <View style={s.logoRow}>
          <View style={s.logoBox}>
            <Ionicons name="fitness" size={28} color="#fff" />
          </View>
          <View>
            <Text style={s.wordmark}>GO24</Text>
            <Text style={s.wordmarkSub}>FITNESS</Text>
          </View>
        </View>
        <Text style={s.heroTitle}>Your Premium{'\n'}Fitness Journey</Text>
        <Text style={s.heroSub}>Move. Train. Perform.</Text>
      </SafeAreaView>

      {/* ── White form panel slides up ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.panelWrap}
      >
        <View style={s.panel}>
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Handle bar */}
            <View style={s.handle} />

            <Text style={s.title}>Welcome back</Text>
            <Text style={s.subtitle}>Sign in to your GO24 account</Text>

            <View style={s.fields}>
              {/* Email */}
              <View style={s.fieldGroup}>
                <Text style={s.label}>EMAIL</Text>
                <View style={s.inputWrap}>
                  <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
                  <TextInput
                    style={s.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="your@email.com"
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
              <View style={s.fieldGroup}>
                <Text style={s.label}>PASSWORD</Text>
                <View style={s.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showPass}
                    autoComplete="current-password"
                    editable={!submitting}
                    onSubmitEditing={handleSubmit}
                    returnKeyType="go"
                  />
                  <Pressable onPress={() => setShowPass(p => !p)} hitSlop={10}>
                    <Ionicons
                      name={showPass ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={colors.textMuted}
                    />
                  </Pressable>
                </View>
              </View>

              {error ? (
                <View style={s.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                  <Text style={s.errorTxt}>{error}</Text>
                </View>
              ) : null}

              <Pressable style={s.forgotBtn}>
                <Text style={s.forgotTxt}>{t.login.forgotPassword}</Text>
              </Pressable>

              {/* CTA */}
              <Pressable
                style={[s.cta, submitting && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <LinearGradient
                  colors={['#E8192C', '#9A0018']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={s.ctaGradient}
                >
                  {submitting
                    ? <Ionicons name="reload-outline" size={20} color="#fff" />
                    : <Text style={s.ctaTxt}>{t.login.submit}</Text>
                  }
                </LinearGradient>
              </Pressable>
            </View>

            {/* Footer */}
            <View style={s.divRow}>
              <View style={s.divLine} />
              <Text style={s.divTxt}>or</Text>
              <View style={s.divLine} />
            </View>

            <Pressable style={s.joinBtn} onPress={() => router.push('/signup' as any)}>
              <Text style={s.joinTxt}>Not a member? </Text>
              <Text style={s.joinBold}>Join GO24</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primary} style={{ marginLeft: 4 }} />
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  // ── Geometric decoration ──
  ring1: {
    position: 'absolute', width: 320, height: 320, borderRadius: 160,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)',
    top: -80, right: -100,
  },
  ring2: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    top: 60, right: -30,
  },
  blob1: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(232,25,44,0.25)', top: H * 0.05, left: -50,
  },
  blob2: {
    position: 'absolute', width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(232,25,44,0.15)', top: H * 0.22, right: 20,
  },
  line: {
    position: 'absolute', height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 1,
  },
  line1: { width: 200, top: H * 0.12, left: -20, transform: [{ rotate: '-20deg' }] },
  line2: { width: 140, top: H * 0.18, left: 40,  transform: [{ rotate: '-20deg' }] },
  line3: { width: 100, top: H * 0.24, left: 80,  transform: [{ rotate: '-20deg' }] },

  // ── Brand ──
  brandArea: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, justifyContent: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  logoBox: {
    width: 56, height: 56, borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  wordmark:    { fontSize: 36, fontFamily: fonts.black, color: '#fff', letterSpacing: 5, lineHeight: 40 },
  wordmarkSub: { fontSize: 10, fontFamily: fonts.bold, color: 'rgba(255,255,255,0.5)', letterSpacing: 5, marginTop: -2 },
  heroTitle: {
    fontSize: 34, fontFamily: fonts.black, color: '#fff',
    lineHeight: 42, marginBottom: spacing.sm,
  },
  heroSub: { fontSize: 13, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.5)', letterSpacing: 1 },

  // ── Panel ──
  panelWrap: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  panel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.2, shadowRadius: 24,
    maxHeight: H * 0.65,
  },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: 40 },

  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center', marginTop: spacing.md, marginBottom: spacing.lg,
  },

  title:    { fontSize: 22, fontFamily: fonts.black, color: colors.text },
  subtitle: { fontSize: 14, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 4, marginBottom: spacing.lg },

  fields:     { gap: spacing.md },
  fieldGroup: { gap: spacing.xs },
  label: { fontSize: 10, fontFamily: fonts.bold, color: colors.textMuted, letterSpacing: 1.5 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.lg, height: 54,
  },
  input: { flex: 1, fontSize: 15, fontFamily: fonts.regular, color: colors.text, padding: 0 },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  errorTxt: { fontSize: 13, fontFamily: fonts.regular, color: colors.error },

  forgotBtn: { alignSelf: 'flex-end' },
  forgotTxt: { fontSize: 13, fontFamily: fonts.semibold, color: colors.primary },

  cta:         { borderRadius: radius.full, overflow: 'hidden', marginTop: spacing.xs },
  ctaGradient: { height: 56, alignItems: 'center', justifyContent: 'center' },
  ctaTxt:      { fontSize: 16, fontFamily: fonts.black, color: '#fff', letterSpacing: 1 },

  divRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  divLine:{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  divTxt: { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted },

  joinBtn:  { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.sm },
  joinTxt:  { fontSize: 14, fontFamily: fonts.regular, color: colors.textMuted },
  joinBold: { fontSize: 14, fontFamily: fonts.bold, color: colors.primary },
});
