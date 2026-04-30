// Web placeholder — Adyen Drop-in requires native build
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '../../src/theme/colors';

export default function UpdateCardWebScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.body}>
        <Pressable onPress={() => router.back()}><Text style={s.back}>← Back</Text></Pressable>
        <Text style={s.icon}>💳</Text>
        <Text style={s.title}>Update Credit Card</Text>
        <Text style={s.sub}>Please use the mobile app to update your credit card.</Text>
      </View>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0A' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  back: { color: colors.primary, fontSize: 15, alignSelf: 'flex-start' },
  icon: { fontSize: 52 },
  title: { fontSize: 22, fontWeight: '800', color: '#fff' },
  sub:  { fontSize: 14, color: '#888', textAlign: 'center' },
});
