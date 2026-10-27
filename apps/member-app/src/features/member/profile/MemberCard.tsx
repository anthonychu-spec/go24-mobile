import { Image, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { brand, brandMark } from '../../../brand';
import { colors } from '../../../theme';
import { T, Tag } from '../../../ui/kit';

/** Gradient membership card at the top of Profile; opens the member pass */
export function MemberCard({ name, memberCode, planName, onPress }: {
  name: string | null; memberCode: string | null; planName: string | null; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open member pass"
      style={({ pressed }) => [s.card, pressed && { opacity: 0.9 }]}
    >
      <LinearGradient
        colors={[colors.primaryMid, colors.primaryDark]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {brandMark
        ? <Image source={brandMark} style={s.mark} resizeMode="contain" accessibilityLabel={brand.name} />
        : <T v="h3" color={colors.onPrimary} style={s.wordmark}>{brand.wordmark.title}</T>}
      {planName ? <Tag color={colors.textSecond} style={s.plan}>{planName}</Tag> : null}
      <T v="h2" color={colors.onPrimary} numberOfLines={2} style={s.name}>
        {(name ?? 'Member').toUpperCase()}
      </T>
      <View style={s.bottom}>
        <T v="micro" color={colors.textSecond}>{memberCode ? `MEMBER NO. ${memberCode}` : 'MEMBER NO. —'}</T>
        <T v="micro" color={colors.textSecond}>VIEW PASS ↗</T>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    minHeight: 190, padding: 22, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.primary, borderRadius: brand.shape.card,
  },
  mark: { width: 48, height: 52, marginBottom: 25 },
  wordmark: { marginBottom: 25 },
  plan: { position: 'absolute', top: 25, right: 20, maxWidth: '55%', textAlign: 'right' },
  // auto margin keeps the name and number on the bottom edge when the card grows
  name: { marginTop: 'auto', fontSize: 31, lineHeight: 32, letterSpacing: 0.6, marginBottom: 8 },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
});
