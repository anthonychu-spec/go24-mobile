import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { brand } from '../../../brand';
import { colors } from '../../../theme';
import { T } from '../../../ui/kit';

/** Bordered row of big numbers (passport metrics, pillar balance); null shows "—" */
export function MetricGrid({ items, style }: {
  items: { label: string; value: number | null }[]; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.grid, style]}>
      {items.map((it, i) => (
        <View key={it.label} style={[s.cell, i < items.length - 1 && s.divider]}
          accessible accessibilityLabel={`${it.label}: ${it.value ?? 'not available'}`}>
          <T v="stat">{it.value ?? '—'}</T>
          <T v="micro" color={colors.textMuted} style={s.label}>{it.label}</T>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: brand.shape.card },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 18, paddingHorizontal: 8 },
  divider: { borderRightWidth: 1, borderRightColor: colors.border },
  label: { marginTop: 8, textAlign: 'center' },
});
