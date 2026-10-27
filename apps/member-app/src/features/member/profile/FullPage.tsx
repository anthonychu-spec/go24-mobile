import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../theme';
import { Icon } from '../../../ui/Icon';
import { PAD, T } from '../../../ui/kit';

/** Back, or home when the page was opened directly (deep link, reload) */
export function useLeave() {
  const router = useRouter();
  return () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
}

/** Full-screen page outside the tabs (pass, delete account): close (top right) or back (top left) */
export function FullPage({ action, children }: { action: 'close' | 'back'; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const leave = useLeave();
  return (
    <KeyboardAvoidingView style={[s.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.bar, action === 'close' && { justifyContent: 'flex-end' }]}>
        {action === 'close' ? (
          <Pressable onPress={leave} hitSlop={12} style={s.btn} accessibilityRole="button" accessibilityLabel="Close">
            <Icon name="close" size={22} color={colors.textSecond} />
          </Pressable>
        ) : (
          <Pressable onPress={leave} hitSlop={12} style={[s.btn, s.back]} accessibilityRole="button" accessibilityLabel="Back">
            <View style={s.flip}><Icon name="chev" size={18} color={colors.textSecond} /></View>
            <T v="label" color={colors.textSecond}>Back</T>
          </Pressable>
        )}
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 8, paddingBottom: 40 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: PAD - 6 },
  btn: { padding: 6 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flip: { transform: [{ rotate: '180deg' }] },
});
