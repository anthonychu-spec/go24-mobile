import { StyleSheet, Text, View } from 'react-native';
import { colors, type } from '../theme';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<Size, number> = { xs: 28, sm: 36, md: 48, lg: 64, xl: 80 };
const FONT_SIZES: Record<Size, number> = { xs: 11, sm: 13, md: 18, lg: 24, xl: 30 };

interface AvatarProps {
  name?: string | null;
  size?: Size;
  color?: string;
}

function getInitials(name: string | null | undefined): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name[0] ?? '?').toUpperCase();
}

export function Avatar({ name, size = 'md', color = colors.primary }: AvatarProps) {
  const dim = SIZES[size];
  return (
    <View
      style={[
        s.circle,
        { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: color },
      ]}
    >
      <Text style={[s.text, { fontSize: FONT_SIZES[size] }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text:   { fontFamily: 'Inter_900Black', color: '#fff' },
});
