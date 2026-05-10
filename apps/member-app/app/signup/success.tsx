import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, type as ty, radius } from '../../src/theme';
import { Button, ScreenWrapper } from '../../src/components';
import { t } from '../../src/i18n';

export default function SignupSuccess() {
  const router = useRouter();

  return (
    <ScreenWrapper>
      <View style={s.content}>
        <View style={s.iconCircle}>
          <Ionicons name="checkmark-circle" size={72} color={colors.success} />
        </View>

        <Text style={s.title}>{t.signup.successTitle}</Text>
        <Text style={s.sub}>{t.signup.successSub}</Text>

        <View style={s.faceCard}>
          <Ionicons name="scan-outline" size={24} color={colors.teal} />
          <Text style={s.faceText}>{t.signup.faceIdPending}</Text>
        </View>

        <Button
          label={t.signup.goToHome}
          variant="primary"
          size="lg"
          fullWidth
          icon="arrow-forward"
          iconPosition="right"
          onPress={() => router.replace('/(tabs)' as any)}
        />
      </View>
    </ScreenWrapper>
  );
}

const s = StyleSheet.create({
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: spacing.xl,
  },
  iconCircle: { marginBottom: spacing.xl },
  title:   { ...ty.h1, color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  sub:     { ...ty.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing['2xl'] },
  faceCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.tealBg, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing['2xl'],
    alignSelf: 'stretch',
  },
  faceText: { ...ty.bodySm, color: colors.teal, flex: 1 },
});
