import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { colors, spacing, type } from '../theme';

interface EmptyStateProps {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, subtitle, action, onAction }: EmptyStateProps) {
  return (
    <View style={s.wrap}>
      {icon && (
        <View style={s.iconBox}>
          <Ionicons name={icon} size={36} color={colors.border} />
        </View>
      )}
      <Text style={s.title}>{title}</Text>
      {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      {action && onAction && (
        <View style={{ marginTop: spacing.sm }}>
          <Button label={action} variant="secondary" size="sm" onPress={onAction} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:    { alignItems: 'center', paddingVertical: spacing['3xl'], paddingHorizontal: spacing.xl, gap: spacing.sm },
  iconBox: { marginBottom: spacing.sm },
  title:   { ...type.h4, color: colors.textMuted, textAlign: 'center' },
  subtitle:{ ...type.bodySm, color: colors.textMuted, textAlign: 'center' },
});
