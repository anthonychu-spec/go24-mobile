import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, type } from '../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  rightElement?: React.ReactNode;
}

export function Input({
  label,
  error,
  hint,
  icon,
  rightElement,
  style,
  ...rest
}: InputProps) {
  const hasError = !!error;

  return (
    <View style={s.wrapper}>
      {label && <Text style={s.label}>{label}</Text>}

      <View style={[s.inputWrap, hasError && s.inputWrapError]}>
        {icon && <Ionicons name={icon} size={18} color={colors.textMuted} style={s.icon} />}
        <TextInput
          style={[s.input, style]}
          placeholderTextColor={colors.textMuted}
          {...rest}
        />
        {rightElement && <View style={s.right}>{rightElement}</View>}
      </View>

      {(error || hint) && (
        <View style={s.footer}>
          {error && <Ionicons name="alert-circle-outline" size={13} color={colors.error} />}
          <Text style={[s.hint, error && s.hintError]}>{error ?? hint}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper:  { gap: spacing.xs },
  label:    { ...type.labelSm, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 50,
  },
  inputWrapError: { borderColor: colors.error, borderWidth: 1 },

  icon:   { marginRight: spacing.sm },
  right:  { marginLeft: spacing.sm },
  input: {
    flex: 1, ...type.body,
    color: colors.text, padding: 0,
  },

  footer:    { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  hint:      { ...type.caption, color: colors.textMuted, flex: 1 },
  hintError: { color: colors.error },
});
