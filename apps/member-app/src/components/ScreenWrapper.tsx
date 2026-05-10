/**
 * Standard screen wrapper — handles SafeAreaView, StatusBar,
 * and consistent background. Use this as the root element
 * of every screen instead of <SafeAreaView> directly.
 */
import { StatusBar, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors } from '../theme';

interface ScreenWrapperProps extends ViewProps {
  /** Which safe area edges to inset. Defaults to all. */
  edges?: Edge[];
  /** Background color. Defaults to colors.bg */
  bg?: string;
  /** StatusBar style. Defaults to dark-content */
  barStyle?: 'dark-content' | 'light-content';
}

export function ScreenWrapper({
  children,
  edges = ['top', 'left', 'right'],
  bg = colors.bg,
  barStyle = 'dark-content',
  style,
  ...rest
}: ScreenWrapperProps) {
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bg }]} edges={edges}>
      <StatusBar barStyle={barStyle} backgroundColor={bg} />
      <View style={[s.content, style]} {...rest}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1 },
  content: { flex: 1 },
});
