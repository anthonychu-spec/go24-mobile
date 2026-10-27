import { Pressable, StyleSheet } from 'react-native';
import { brand } from '../../../brand';
import { dayParts } from '../../../lib/hkTime';
import { colors } from '../../../theme';
import { HScroll, T } from '../../../ui/kit';

/** Date buttons across the booking window; the first one reads TODAY */
export function DayStrip({ days, value, onChange }: { days: string[]; value: string; onChange: (key: string) => void }) {
  return (
    <HScroll gap={7}>
      {days.map((key, i) => {
        const d = dayParts(key);
        const on = key === value;
        const label = on ? colors.bg : colors.textMuted;
        return (
          <Pressable key={key} onPress={() => onChange(key)} style={[s.day, on && s.dayOn]}
            accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={i === 0 ? `Today, ${d.long}` : d.long}>
            <T v="micro" color={label}>{i === 0 ? 'TODAY' : d.wd}</T>
            <T v="h3" color={on ? colors.bg : colors.textSecond} style={s.num}>{d.day}</T>
            <T v="micro" color={label}>{d.month}</T>
          </Pressable>
        );
      })}
    </HScroll>
  );
}

const s = StyleSheet.create({
  day: {
    minWidth: 50, paddingVertical: 9, paddingHorizontal: 5, alignItems: 'center', gap: 3,
    borderWidth: 1, borderColor: colors.border, borderRadius: brand.shape.button,
  },
  dayOn: { backgroundColor: colors.textSecond, borderColor: colors.textSecond },
  num: { fontSize: 26, lineHeight: 30 },
});
