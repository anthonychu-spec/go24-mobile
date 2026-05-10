import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StatusBar, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/context';
import { t } from '../../src/i18n';
import { colors, fonts, spacing, type as ty, radius, shadows } from '../../src/theme';
import { Button, Input } from '../../src/components';

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
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
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

      {/* ── Brand hero with gradient ── */}
      <LinearGradient
        colors={[colors.primary, colors.primaryMid, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.hero}
      >
        <SafeAreaView edges={['top']}>
          <View style={s.heroContent}>
            {/* Decorative geometric lines */}
            <View style={s.heroDecor}>
              <View style={[s.decorLine, s.decorLine1]} />
              <View style={[s.decorLine, s.decorLine2]} />
              <View style={[s.decorLine, s.decorLine3]} />
            </View>

            <View style={s.logoRow}>
              <View style={s.logoSymbol}>
                <Ionicons name="fitness" size={30} color="#fff" />
              </View>
              <View>
                <Text style={s.logoWordmark}>GO24</Text>
                <Text style={s.logoSub}>FITNESS</Text>
              </View>
            </View>

            <Text style={s.heroTagline}>Move. Train. Perform.</Text>
            <Text style={s.heroDesc}>
              Your premium fitness experience starts here
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── White form panel ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.panel}
      >
        <ScrollView
          contentContainerStyle={s.panelScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Text style={s.panelTitle}>{t.login.title}</Text>
          <Text style={s.panelSub}>{t.login.subtitle}</Text>

          <View style={s.fields}>
            <Input
              label={t.login.emailLabel}
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              placeholder={t.login.emailPlaceholder}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!submitting}
            />

            <Input
              label={t.login.passwordLabel}
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              placeholder={t.login.passwordPlaceholder}
              secureTextEntry={!showPass}
              autoComplete="current-password"
              editable={!submitting}
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
              error={error || undefined}
              rightElement={
                <Pressable onPress={() => setShowPass(p => !p)} hitSlop={8}>
                  <Ionicons
                    name={showPass ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.textMuted}
                  />
                </Pressable>
              }
            />

            <Pressable style={s.forgotBtn}>
              <Text style={s.forgotText}>{t.login.forgotPassword}</Text>
            </Pressable>

            <Button
              label={t.login.submit}
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting}
              onPress={handleSubmit}
            />
          </View>

          {/* ── Footer ── */}
          <View style={s.footer}>
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>or</Text>
              <View style={s.dividerLine} />
            </View>

            <Pressable
              style={({ pressed }) => [s.joinBtn, pressed && s.joinPressed]}
              onPress={() => router.push('/(auth)/landing' as any)}
            >
              <Text style={s.joinText}>{t.login.newToGo24} </Text>
              <Text style={s.joinTextBold}>{t.login.joinNow}</Text>
              <Ionicons name="arrow-forward" size={15} color={colors.primary} style={{ marginLeft: 4 }} />
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const PANEL_RADIUS = radius['2xl'] + 4;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },

  // ── Hero ──
  hero: { paddingBottom: PANEL_RADIUS + spacing.md },
  heroContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.xl,
  },
  heroDecor: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    opacity: 0.08,
  },
  decorLine: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  decorLine1: {
    width: 180, height: 3,
    top: 30, right: -40,
    transform: [{ rotate: '-25deg' }],
  },
  decorLine2: {
    width: 120, height: 2,
    top: 80, right: 10,
    transform: [{ rotate: '-25deg' }],
  },
  decorLine3: {
    width: 90, height: 2,
    top: 60, right: -10,
    transform: [{ rotate: '-25deg' }],
  },

  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  logoSymbol: {
    width: 54, height: 54, borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoWordmark: {
    fontSize: 30, fontFamily: fonts.black, color: '#fff',
    letterSpacing: 4,
  },
  logoSub: {
    fontSize: 10, fontFamily: fonts.bold,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 4, marginTop: -1,
  },
  heroTagline: {
    fontSize: 22, fontFamily: fonts.black, color: '#fff',
    letterSpacing: 0.3,
    marginBottom: spacing.xs,
  },
  heroDesc: {
    ...ty.body, color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.2,
  },

  // ── Form panel ──
  panel: {
    flex: 1, backgroundColor: colors.card,
    borderTopLeftRadius: PANEL_RADIUS,
    borderTopRightRadius: PANEL_RADIUS,
    marginTop: -PANEL_RADIUS,
  },
  panelScroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['3xl'],
  },
  panelTitle: {
    ...ty.h2, color: colors.text,
  },
  panelSub: {
    ...ty.body, color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },

  fields: { gap: spacing.base },

  forgotBtn: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.xs,
  },
  forgotText: {
    ...ty.bodySm, color: colors.primary,
  },

  // ── Footer ──
  footer: {
    marginTop: spacing['2xl'],
    gap: spacing.lg,
  },
  dividerRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  dividerLine: {
    flex: 1, height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dividerText: { ...ty.caption, color: colors.textMuted },

  joinBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.primaryBg,
    borderRadius: radius.md,
  },
  joinPressed: { opacity: 0.8 },
  joinText: { ...ty.body, color: colors.textSecond },
  joinTextBold: { ...ty.bodyBold, color: colors.primary },
});
