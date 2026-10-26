import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../src/theme/colors';
export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={s.c}>
        <Text style={s.t}>Page not found</Text>
        <Link href="/(tabs)" style={s.l}>Go home</Link>
      </View>
    </>
  );
}
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 16 },
  t: { color: colors.text, fontSize: 18 },
  l: { color: colors.link, fontSize: 16 },
});
