import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { publicClient } from '../../src/api/public';
import { colors, fonts, spacing, type as ty, radius } from '../../src/theme';
import { Button, Card, ScreenWrapper, ScreenHeader } from '../../src/components';
import { t } from '../../src/i18n';
import { useSignup } from './_layout';

interface Plan {
  id: number; name: string;
  membershipFee: number; joiningFee: number; adminFee: number;
  description: string | null;
}

export default function SignupStep2() {
  const router = useRouter();
  const { data, update } = useSignup();
  const [plans, setPlans]       = useState<Plan[]>([]);
  const [selected, setSelected] = useState<number>(data.planId);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    try {
      const { data: d } = await publicClient.get<Plan[]>('/public/plans', {
        params: data.clubId ? { clubId: data.clubId } : undefined,
      });
      setPlans(d);
    } catch {
      setError(t.signup.couldNotLoadPlans);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedPlan = plans.find(p => p.id === selected);

  const next = () => {
    if (!selectedPlan) return;
    update({
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      planPriceHkd: selectedPlan.membershipFee,
      joiningFee: selectedPlan.joiningFee,
      adminFee: selectedPlan.adminFee,
    });
    router.push('/signup/selfie');
  };

  return (
    <ScreenWrapper>
      <ScreenHeader showBack title={t.signup.step2Title} subtitle={t.signup.step2Sub}
        rightLabel="2/4" />

      <ScrollView contentContainerStyle={s.scroll}>
        {loading ? (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: spacing['3xl'] }} />
        ) : error ? (
          <View style={s.errorBox}>
            <Text style={s.error}>{error}</Text>
            <Button label={t.signup.tryAgain} variant="secondary" size="sm" onPress={load} />
          </View>
        ) : (
          <View style={s.plans}>
            {plans.map(p => (
              <Pressable key={p.id} onPress={() => setSelected(p.id)}>
                <Card style={[s.card, selected === p.id && s.cardSelected]}>
                  <View style={s.cardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.planName}>{p.name}</Text>
                      {p.description ? <Text style={s.planDesc}>{p.description}</Text> : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.price}>HK${p.membershipFee}</Text>
                      <Text style={s.perMonth}>{t.signup.perMonth}</Text>
                    </View>
                  </View>

                  {(p.joiningFee > 0 || p.adminFee > 0) && (
                    <View style={s.fees}>
                      {p.joiningFee > 0 && (
                        <View style={s.feeRow}>
                          <Text style={s.feeLabel}>{t.signup.joiningFee}</Text>
                          <Text style={s.feeVal}>HK${p.joiningFee}</Text>
                        </View>
                      )}
                      {p.adminFee > 0 && (
                        <View style={s.feeRow}>
                          <Text style={s.feeLabel}>{t.signup.adminFee}</Text>
                          <Text style={s.feeVal}>HK${p.adminFee}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {selected === p.id && (
                    <View style={s.checkIcon}>
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    </View>
                  )}
                </Card>
              </Pressable>
            ))}
          </View>
        )}

        <Button label={t.signup.nextSelfie} variant="primary" size="lg" fullWidth
          disabled={!selected} onPress={next} icon="arrow-forward" iconPosition="right" />
      </ScrollView>
    </ScreenWrapper>
  );
}

const s = StyleSheet.create({
  scroll:   { padding: spacing.xl, paddingBottom: spacing['3xl'] },
  plans:    { gap: spacing.md, marginBottom: spacing.xl },
  card:     { borderWidth: 1.5, borderColor: colors.border },
  cardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryBg + '30' },
  cardRow:  { flexDirection: 'row', alignItems: 'flex-start' },
  planName: { ...ty.h4, color: colors.text },
  planDesc: { ...ty.bodySm, color: colors.textMuted, marginTop: spacing.xs },
  price:    { fontSize: 22, fontFamily: fonts.black, color: colors.primary },
  perMonth: { ...ty.caption, color: colors.textMuted },
  fees:     { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: spacing.xs },
  feeRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  feeLabel: { ...ty.bodySm, color: colors.textMuted },
  feeVal:   { ...ty.bodySm, color: colors.textSecond, fontFamily: fonts.semibold },
  checkIcon:{ position: 'absolute', top: spacing.md, right: spacing.md },
  errorBox: { alignItems: 'center', gap: spacing.md, marginVertical: spacing['2xl'] },
  error:    { ...ty.body, color: colors.error },
});
