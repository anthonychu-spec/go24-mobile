import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, type } from '../theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  /** Right side: icon button */
  rightIcon?: React.ComponentProps<typeof Ionicons>['name'];
  rightLabel?: string;
  onRight?: () => void;
  rightBadge?: boolean;
}

export function ScreenHeader({
  title,
  subtitle,
  showBack = false,
  rightIcon,
  rightLabel,
  onRight,
  rightBadge = false,
}: ScreenHeaderProps) {
  const router = useRouter();
  return (
    <View style={s.wrap}>
      {/* Left — back button or spacer */}
      {showBack ? (
        <Pressable style={s.iconBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
      ) : (
        <View style={s.spacer} />
      )}

      {/* Centre — title */}
      <View style={s.centre}>
        <Text style={s.title}>{title}</Text>
        {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      </View>

      {/* Right */}
      {(rightIcon || rightLabel) ? (
        <Pressable style={s.iconBtn} onPress={onRight} hitSlop={8}>
          {rightIcon && <Ionicons name={rightIcon} size={22} color={colors.text} />}
          {rightLabel && <Text style={s.rightLabel}>{rightLabel}</Text>}
          {rightBadge && <View style={s.badge} />}
        </Pressable>
      ) : (
        <View style={s.spacer} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  centre:    { flex: 1, alignItems: 'center' },
  title:     { ...type.h4, color: colors.text },
  subtitle:  { ...type.caption, color: colors.textMuted, marginTop: 1 },
  spacer:    { width: 40 },
  iconBtn:   { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  rightLabel:{ ...type.label, color: colors.primary },
  badge: {
    position: 'absolute', top: 6, right: 6,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 1.5, borderColor: colors.card,
  },
});
