import { Image, StyleSheet, View } from 'react-native';
import { brand, brandContent } from '../../brand';
import { colors } from '../../theme';
import { Sheet, T } from '../../ui/kit';

/** Address and opening hours (Home "This is your LAB", Profile "Your club") */
export function ClubSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const club = brand.club;
  if (!club) return null;
  return (
    <Sheet visible={visible} onClose={onClose} eyebrow="YOUR CLUB" title={club.name}>
      {brandContent ? <Image source={brandContent.clubImage} style={s.img} resizeMode="cover" /> : null}
      <View style={s.block}>
        <T v="eyebrow" color={colors.textMuted}>ADDRESS</T>
        {club.address.map((line) => <T key={line} v="body">{line}</T>)}
      </View>
      <View style={s.block}>
        <T v="eyebrow" color={colors.textMuted}>OPENING HOURS</T>
        {club.hours.map((line) => <T key={line} v="body">{line}</T>)}
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  img: { width: '100%', height: 150, marginBottom: 18, borderRadius: brand.shape.card },
  block: { gap: 4, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border },
});
