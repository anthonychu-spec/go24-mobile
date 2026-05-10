import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, type, shadows } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: any;
}

const HEIGHT: Record<Size, number> = { sm: 36, md: 44, lg: 54 };
const H_PAD:  Record<Size, number> = { sm: 14, md: 20, lg: 24 };
const ICON_SZ: Record<Size, number> = { sm: 15, md: 17, lg: 20 };

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const containerStyle = [
    s.base,
    { height: HEIGHT[size], paddingHorizontal: H_PAD[size], borderRadius: radius.lg },
    variant === 'primary'   && s.primary,
    variant === 'secondary' && s.secondary,
    variant === 'ghost'     && s.ghost,
    variant === 'danger'    && s.danger,
    fullWidth && s.fullWidth,
    isDisabled && s.disabled,
    style,
  ] as any[];

  const textStyle = [
    size === 'sm' ? type.btnSm : size === 'lg' ? type.btnLg : type.btnMd,
    variant === 'primary'   && { color: '#fff' },
    variant === 'secondary' && { color: colors.primary },
    variant === 'ghost'     && { color: colors.primary },
    variant === 'danger'    && { color: '#fff' },
    isDisabled && s.disabledText,
  ] as any[];

  const iconColor =
    variant === 'primary' || variant === 'danger' ? '#fff'
    : isDisabled ? colors.textMuted
    : colors.primary;

  return (
    <Pressable
      style={({ pressed }) => [
        ...containerStyle,
        pressed && !isDisabled && s.pressed,
      ]}
      disabled={isDisabled}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? '#fff' : colors.primary}
        />
      ) : (
        <View style={s.inner}>
          {icon && iconPosition === 'left' && (
            <Ionicons name={icon} size={ICON_SZ[size]} color={iconColor} />
          )}
          <Text style={textStyle}>{label}</Text>
          {icon && iconPosition === 'right' && (
            <Ionicons name={icon} size={ICON_SZ[size]} color={iconColor} />
          )}
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  base:       { alignItems: 'center', justifyContent: 'center' },
  inner:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fullWidth:  { alignSelf: 'stretch' },
  pressed:    { opacity: 0.88, transform: [{ scale: 0.98 }] },
  disabled:   { opacity: 0.45 },
  disabledText: { color: colors.textMuted },

  primary:   { backgroundColor: colors.primary, ...shadows.cta(colors.primary) },
  secondary: { backgroundColor: colors.primaryBg, borderWidth: 1.5, borderColor: colors.primary },
  ghost:     { backgroundColor: 'transparent' },
  danger:    { backgroundColor: colors.error, ...shadows.cta(colors.error) },
});
