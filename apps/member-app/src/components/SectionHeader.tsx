import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../theme';

interface SectionHeaderProps {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: any;
}

export function SectionHeader({ title, action, onAction, style }: SectionHeaderProps) {
  return (
    <View style={[s.wrap, style]}>
      <Text style={s.title}>{title}</Text>
      {action && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={s.action}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:  { ...type.overline, color: colors.textMuted },
  action: { ...type.labelSm, color: colors.primary },
});
