import { StyleSheet, View } from 'react-native';
import { brand, brandContent } from '../../../brand';
import { colors } from '../../../theme';
import { Icon } from '../../../ui/Icon';
import { Note, Sheet, T } from '../../../ui/kit';

/** First-visit guidance (brand content) plus where and when to find the club */
export function HelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const club = brand.club;
  const tips = brandContent?.firstVisit ?? [];
  return (
    <Sheet visible={visible} onClose={onClose} eyebrow="YOUR FIRST VISIT" title="START WITH CONFIDENCE.">
      {tips.map((line) => (
        <View key={line} style={s.tip}>
          <View style={{ marginTop: 2 }}><Icon name="check" size={16} color={colors.cta} /></View>
          <T v="body" color={colors.textSecond} style={{ flex: 1 }}>{line}</T>
        </View>
      ))}
      {club ? (
        <>
          <View style={s.block}>
            <T v="eyebrow" color={colors.textMuted}>ADDRESS</T>
            <T v="label" style={{ marginTop: 2 }}>{club.name}</T>
            {club.address.map((line) => <T key={line} v="body">{line}</T>)}
          </View>
          <View style={s.block}>
            <T v="eyebrow" color={colors.textMuted}>OPENING HOURS</T>
            {club.hours.map((line) => <T key={line} v="body">{line}</T>)}
          </View>
        </>
      ) : null}
      <Note>Any questions before your session? Ask the club team when you arrive.</Note>
    </Sheet>
  );
}

const s = StyleSheet.create({
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border },
  block: { gap: 4, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border },
});
