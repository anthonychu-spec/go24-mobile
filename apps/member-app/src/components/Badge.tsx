import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type } from '../theme';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary';

const VARIANT_COLORS: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  success: { bg: colors.greenBg,   text: colors.green,  dot: colors.green  },
  warning: { bg: colors.amberBg,   text: colors.amber,  dot: colors.amber  },
  error:   { bg: colors.roseBg,    text: colors.rose,   dot: colors.rose   },
  info:    { bg: colors.tealBg,    text: colors.teal,   dot: colors.teal   },
  neutral: { bg: colors.bg,        text: colors.textMuted, dot: colors.textMuted },
  primary: { bg: colors.primaryBg, text: colors.primary,dot: colors.primary},
};

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  dot?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}

export function Badge({ label, variant = 'neutral', dot = false, icon }: BadgeProps) {
  const c = VARIANT_COLORS[variant];
  return (
    <View style={[s.wrap, { backgroundColor: c.bg }]}>
      {dot && <View style={[s.dot, { backgroundColor: c.dot }]} />}
      {icon && <Ionicons name={icon} size={11} color={c.text} />}
      <Text style={[s.text, { color: c.text }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2, paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  dot:  { width: 6, height: 6, borderRadius: 3 },
  text: { ...type.labelSm },
});
