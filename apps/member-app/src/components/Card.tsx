import { Pressable, StyleSheet, View, type PressableProps, type ViewProps } from 'react-native';
import { colors, spacing, radius, shadows } from '../theme';

interface CardProps extends ViewProps {
  /** Makes the card tappable with press feedback */
  onPress?: () => void;
  /** Custom padding — defaults to spacing.base (16) */
  padding?: number;
  /** Border radius variant */
  rounded?: keyof typeof radius;
  /** Show colored left accent stripe */
  accentColor?: string;
  /** Soft card bg (cardSoft instead of card) */
  soft?: boolean;
}

export function Card({
  children,
  onPress,
  padding = spacing.base,
  rounded = 'xl',
  accentColor,
  soft = false,
  style,
  ...rest
}: CardProps) {
  const containerStyle = [
    s.card,
    {
      padding,
      borderRadius: radius[rounded],
      backgroundColor: soft ? colors.cardSoft : colors.card,
    },
    style,
  ];

  const inner = (
    <View style={s.inner}>
      {accentColor && <View style={[s.accent, { backgroundColor: accentColor }]} />}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [...containerStyle, pressed && s.pressed]}
        onPress={onPress}
        {...rest as any}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View style={containerStyle} {...rest}>
      {inner}
    </View>
  );
}

const s = StyleSheet.create({
  card:    { ...shadows.card, overflow: 'hidden' },
  inner:   { flexDirection: 'row', flex: 1 },
  accent:  { width: 4, marginRight: 14, borderRadius: 2, marginVertical: -16, marginLeft: -16 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
});
