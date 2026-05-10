import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts, spacing, type as ty, radius } from '../../src/theme';
import { Button, Card } from '../../src/components';
import { t } from '../../src/i18n';

const FEATURES = [
  { icon: 'time-outline' as const,    title: t.landing.feature1Title, desc: t.landing.feature1Desc, color: colors.blue,   bg: colors.blueBg },
  { icon: 'scan-outline' as const,    title: t.landing.feature2Title, desc: t.landing.feature2Desc, color: colors.teal,   bg: colors.tealBg },
  { icon: 'location-outline' as const, title: t.landing.feature3Title, desc: t.landing.feature3Desc, color: colors.indigo, bg: colors.indigoBg },
  { icon: 'barbell-outline' as const, title: t.landing.feature4Title, desc: t.landing.feature4Desc, color: colors.amber,  bg: colors.amberBg },
];

export default function LandingScreen() {
  const router = useRouter();

  return (
    <View style={s.root}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <LinearGradient
          colors={[colors.primary, colors.primaryMid, colors.primaryDark]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <SafeAreaView edges={['top']}>
            <View style={s.heroInner}>
              <View style={s.logoRow}>
                <View style={s.logoBox}>
                  <Ionicons name="fitness" size={28} color="#fff" />
                </View>
                <View>
                  <Text style={s.logoWord}>GO24</Text>
                  <Text style={s.logoSub}>FITNESS</Text>
                </View>
              </View>

              <Text style={s.heroTitle}>{t.landing.hero}</Text>
              <Text style={s.heroSub}>{t.landing.heroSub}</Text>

              <Button
                label={t.landing.joinNow}
                variant="secondary"
                size="lg"
                fullWidth
                icon="arrow-forward"
                iconPosition="right"
                onPress={() => router.push('/signup')}
                style={s.heroCta}
              />
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Features */}
        <View style={s.features}>
          <View style={s.featureGrid}>
            {FEATURES.map(f => (
              <Card key={f.title} style={s.featureCard}>
                <View style={[s.iconBox, { backgroundColor: f.bg }]}>
                  <Ionicons name={f.icon} size={24} color={f.color} />
                </View>
                <Text style={s.featureTitle}>{f.title}</Text>
                <Text style={s.featureDesc}>{f.desc}</Text>
              </Card>
            ))}
          </View>
        </View>

        {/* Bottom CTA */}
        <View style={s.bottom}>
          <Button
            label={t.landing.joinNow}
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => router.push('/signup')}
          />

          <Pressable
            style={s.signInRow}
            onPress={() => router.replace('/(auth)/login' as any)}
          >
            <Text style={s.signInText}>{t.landing.alreadyMember} </Text>
            <Text style={s.signInLink}>{t.landing.signIn}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  hero: { paddingBottom: radius['2xl'] + spacing.lg },
  heroInner: {
    paddingHorizontal: spacing.xl, paddingTop: spacing['3xl'],
    paddingBottom: spacing.xl,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing['2xl'] },
  logoBox: {
    width: 52, height: 52, borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoWord: { fontSize: 28, fontFamily: fonts.black, color: '#fff', letterSpacing: 4 },
  logoSub:  { fontSize: 9, fontFamily: fonts.bold, color: 'rgba(255,255,255,0.55)', letterSpacing: 4 },

  heroTitle: { ...ty.h1, color: '#fff', marginBottom: spacing.sm },
  heroSub:   { ...ty.body, color: 'rgba(255,255,255,0.7)', marginBottom: spacing['2xl'] },
  heroCta:   { backgroundColor: '#fff', borderColor: '#fff' },

  features: {
    paddingHorizontal: spacing.base, paddingTop: spacing.xl,
    marginTop: -radius['2xl'],
  },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  featureCard: { width: '48%' as any, padding: spacing.lg },
  iconBox: {
    width: 48, height: 48, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  featureTitle: { ...ty.h4, color: colors.text, marginBottom: spacing.xs },
  featureDesc:  { ...ty.bodySm, color: colors.textMuted },

  bottom: {
    paddingHorizontal: spacing.xl, paddingTop: spacing['2xl'],
    paddingBottom: spacing['3xl'],
  },
  signInRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingTop: spacing.lg,
  },
  signInText: { ...ty.body, color: colors.textMuted },
  signInLink: { ...ty.bodyBold, color: colors.primary },
});
