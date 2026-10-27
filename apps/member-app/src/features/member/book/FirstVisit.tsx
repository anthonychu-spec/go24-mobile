import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { brand, brandContent } from '../../../brand';
import { colors } from '../../../theme';
import { Icon } from '../../../ui/Icon';
import { Card, Sheet, T } from '../../../ui/kit';

/** "First time in THE LAB?" card and its sheet (brandContent.firstVisit) */
export function FirstVisitCard() {
  const [open, setOpen] = useState(false);
  const items = brandContent?.firstVisit ?? [];
  if (!items.length) return null;
  return (
    <>
      <Card onPress={() => setOpen(true)} style={s.card}>
        <Icon name="info" size={20} color={colors.cta} />
        <View style={{ flex: 1 }}>
          <T v="h3" style={{ fontSize: 22, lineHeight: 24 }}>{`FIRST TIME IN ${brand.name.toUpperCase()}?`}</T>
          <T v="small" color={colors.textMuted} style={{ marginTop: 4 }}>When to arrive. What to bring.</T>
        </View>
        <Icon name="chev" size={16} color={colors.textMuted} />
      </Card>
      <Sheet visible={open} onClose={() => setOpen(false)} eyebrow="YOUR FIRST VISIT" title="START WITH CONFIDENCE.">
        {items.map((line, i) => (
          <View key={line} style={s.item}>
            <T v="micro" color={colors.cta} style={s.num}>{String(i + 1).padStart(2, '0')}</T>
            <T v="body" style={{ flex: 1 }}>{line}</T>
          </View>
        ))}
      </Sheet>
    </>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  item: { flexDirection: 'row', gap: 14, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border },
  num: { width: 20, paddingTop: 5 },
});
