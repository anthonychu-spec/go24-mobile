import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, type } from '../theme';

interface ListRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
  iconBg?: string;
  label: string;
  sublabel?: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  rightElement?: React.ReactNode;
  divider?: boolean;
  style?: any;
}

export function ListRow({
  icon,
  iconColor = colors.primary,
  iconBg = colors.primaryBg,
  label,
  sublabel,
  value,
  onPress,
  showChevron = true,
  rightElement,
  divider = true,
  style,
}: ListRowProps) {
  const content = (
    <View style={[s.row, divider && s.divider, style]}>
      {/* Icon */}
      <View style={[s.iconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>

      {/* Label */}
      <View style={s.labelWrap}>
        <Text style={s.label}>{label}</Text>
        {sublabel && <Text style={s.sublabel}>{sublabel}</Text>}
      </View>

      {/* Right side */}
      {rightElement ?? (
        value
          ? <Text style={s.value} numberOfLines={1}>{value}</Text>
          : showChevron
            ? <Ionicons name="chevron-forward" size={16} color={colors.border} />
            : null
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => pressed && s.pressed}
        onPress={onPress}
        hitSlop={4}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const s = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  divider:  { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pressed:  { backgroundColor: colors.bg },
  iconBox: {
    width: 36, height: 36, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  labelWrap: { flex: 1, gap: 2 },
  label:     { ...type.body, color: colors.text },
  sublabel:  { ...type.caption, color: colors.textMuted },
  value:     { ...type.label, color: colors.textMuted, maxWidth: 140 },
});
