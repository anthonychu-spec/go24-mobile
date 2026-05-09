import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { publicClient } from '../../src/api/public';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import { useSignup } from './_layout';

interface Plan { id: number; name: string; priceHkd: number; description: string | null }

export default function SignupStep2() {
  const router = useRouter();
  const { data, update } = useSignup();
  const [plans, setPlans]       = useState<Plan[]>([]);
  const [selected, setSelected] = useState<number>(data.planId);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    try {
      const { data: d } = await publicClient.get<Plan[]>('/public/plans');
      setPlans(d);
    } catch {
      setError('Could not load plans. Please try again.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const next = () => {
    const plan = plans.find(p => p.id === selected);
    if (!plan) return;
    update({ planId: plan.id, planName: plan.name, planPriceHkd: plan.priceHkd });
    router.push('/signup/selfie');
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}><Text style={s.back}>← Back</Text></Pressable>
          <Text style={s.step}>Step 2 of 4</Text>
        </View>
        <Text style={s.title}>Choose Your Plan</Text>
        <Text style={s.sub}>Select the membership that suits you</Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={s.errorBox}>
            <Text style={s.error}>{error}</Text>
            <Pressable onPress={load} style={s.retryBtn}><Text style={s.retryTxt}>Try Again</Text></Pressable>
          </View>
        ) : (
          <View style={s.plans}>
            {plans.map(p => (
              <Pressable
                key={p.id}
                style={[s.card, selected === p.id && s.cardSelected]}
                onPress={() => setSelected(p.id)}
              >
                <View style={s.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.planName}>{p.name}</Text>
                    {p.description ? <Text style={s.planDesc}>{p.description}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.price}>HK${p.priceHkd}</Text>
                    <Text style={s.perMonth}>/month</Text>
                  </View>
                </View>
                {selected === p.id && (
                  <View style={s.checkIcon}>
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}

        <Pressable style={[s.btn, !selected && s.btnOff]} onPress={next} disabled={!selected}>
          <Text style={s.btnTxt}>Next: Take Selfie →</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  back:   { fontSize: 14, color: colors.primary, fontFamily: fonts.semibold },
  step:   { fontSize: 12, color: colors.textMuted },
  title:  { fontSize: 26, fontFamily: fonts.black, color: colors.text, marginBottom: 4 },
  sub:    { fontSize: 14, color: colors.textMuted, marginBottom: 20 },
  plans:  { gap: 12, marginBottom: 24 },
  card:   { backgroundColor: colors.card, borderRadius: 16, padding: 18, borderWidth: 1.5, borderColor: colors.border },
  cardSelected: { borderColor: colors.primary },
  cardRow:{ flexDirection: 'row', alignItems: 'flex-start' },
  planName:{ fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  planDesc:{ fontSize: 12, color: colors.textMuted, marginTop: 3 },
  price:  { fontSize: 20, fontFamily: fonts.black, color: colors.primary },
  perMonth:{ fontSize: 11, color: colors.textMuted },
  checkIcon:{ position: 'absolute', top: 12, right: 12 },
  errorBox:{ alignItems: 'center', gap: 12, marginVertical: 20 },
  error:  { color: colors.error, fontFamily: fonts.regular },
  retryBtn:{ borderWidth: 1, borderColor: colors.primary, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  retryTxt:{ color: colors.primary, fontFamily: fonts.semibold },
  btn:    { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnOff: { opacity: 0.4 },
  btnTxt: { fontSize: 16, fontFamily: fonts.bold, color: '#fff' },
});
