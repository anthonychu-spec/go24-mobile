import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/context';
import { t } from '../../src/i18n';
import { colors } from '../../src/theme/colors';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.c}>
        <Text style={s.logo}>GO24</Text>
        <Text style={s.welcome}>Welcome{user?.email ? `, ${user.email}` : ''}</Text>
        <Text style={s.role}>{user?.role?.toUpperCase()}</Text>
        <Pressable style={s.btn} onPress={logout}>
          <Text style={s.btnText}>{t.auth.logout}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  c: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 28 },
  logo: { fontSize: 42, fontWeight: '900', color: colors.primary, letterSpacing: 6 },
  welcome: { fontSize: 18, color: colors.text, fontWeight: '600' },
  role: { fontSize: 13, color: colors.textMuted, letterSpacing: 1 },
  btn: { marginTop: 32, paddingHorizontal: 24, paddingVertical: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
  btnText: { color: colors.textMuted, fontSize: 14 },
});
