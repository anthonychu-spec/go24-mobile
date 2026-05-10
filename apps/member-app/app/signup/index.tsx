import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { publicClient } from '../../src/api/public';
import { colors, fonts, spacing, type as ty, radius } from '../../src/theme';
import { Button, Input, ScreenWrapper, ScreenHeader } from '../../src/components';
import { t } from '../../src/i18n';
import { useSignup } from './_layout';

interface Club { id: number; name: string }

export default function SignupStep1() {
  const router = useRouter();
  const { data, update } = useSignup();

  const [form, setForm] = useState({
    firstName: data.firstName, lastName: data.lastName,
    email: data.email, phone: data.phone, dateOfBirth: data.dateOfBirth,
    sex: data.sex, clubId: data.clubId, clubName: data.clubName,
    address: data.address,
  });
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [showClubPicker, setShowClubPicker] = useState(false);
  const [error, setError] = useState('');

  const loadClubs = useCallback(async () => {
    try {
      const { data: d } = await publicClient.get<Club[]>('/public/clubs');
      setClubs(d);
    } catch {
      setError(t.signup.couldNotLoadClubs);
    } finally { setClubsLoading(false); }
  }, []);

  useEffect(() => { loadClubs(); }, [loadClubs]);

  const patch = (key: string, val: string | number) =>
    setForm(prev => ({ ...prev, [key]: key === 'email' ? (val as string).toLowerCase() : val }));

  const valid =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    form.email.includes('@') &&
    form.phone.trim().length >= 8 &&
    /^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth) &&
    form.clubId > 0;

  const next = () => {
    if (!valid) { setError(t.signup.fillAllFields); return; }
    update(form);
    router.push('/signup/plan');
  };

  return (
    <ScreenWrapper>
      <ScreenHeader showBack title={t.signup.step1Title} subtitle={t.signup.step1Sub}
        rightLabel="1/4" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.form}>
            <Input label={t.signup.firstName} icon="person-outline"
              value={form.firstName} onChangeText={v => patch('firstName', v)}
              placeholder="John" autoCapitalize="words" />

            <Input label={t.signup.lastName} icon="person-outline"
              value={form.lastName} onChangeText={v => patch('lastName', v)}
              placeholder="Doe" autoCapitalize="words" />

            <Input label={t.signup.email} icon="mail-outline"
              value={form.email} onChangeText={v => patch('email', v)}
              placeholder="john@example.com" keyboardType="email-address"
              autoCapitalize="none" autoComplete="email" />

            <Input label={t.signup.phone} icon="call-outline"
              value={form.phone} onChangeText={v => patch('phone', v)}
              placeholder="+852 9123 4567" keyboardType="phone-pad" />

            <Input label={t.signup.dateOfBirth} icon="calendar-outline"
              value={form.dateOfBirth} onChangeText={v => patch('dateOfBirth', v)}
              placeholder="1990-01-31" hint={t.signup.dobHint} />

            {/* Gender toggle */}
            <View style={s.fieldGap}>
              <Text style={s.label}>{t.signup.gender}</Text>
              <View style={s.genderRow}>
                {(['Male', 'Female'] as const).map(g => (
                  <Pressable key={g}
                    style={[s.genderBtn, form.sex === g && s.genderBtnActive]}
                    onPress={() => patch('sex', g)}>
                    <Ionicons name={g === 'Male' ? 'male' : 'female'} size={16}
                      color={form.sex === g ? '#fff' : colors.textMuted} />
                    <Text style={[s.genderTxt, form.sex === g && s.genderTxtActive]}>
                      {g === 'Male' ? t.signup.genderMale : t.signup.genderFemale}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Club selector */}
            <View style={s.fieldGap}>
              <Text style={s.label}>{t.signup.homeClub}</Text>
              {clubsLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.sm }} />
              ) : (
                <Pressable style={s.clubPicker} onPress={() => setShowClubPicker(true)}>
                  <Ionicons name="location-outline" size={18} color={colors.textMuted} />
                  <Text style={[s.clubPickerTxt, !form.clubName && { color: colors.textMuted }]}>
                    {form.clubName || t.signup.selectClub}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                </Pressable>
              )}
            </View>
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <Button label={t.signup.nextPlan} variant="primary" size="lg" fullWidth
            disabled={!valid} onPress={next} icon="arrow-forward" iconPosition="right" />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Club picker modal */}
      <Modal visible={showClubPicker} animationType="slide" transparent>
        <View style={s.modalScrim}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{t.signup.homeClub}</Text>
            <ScrollView style={s.modalList}>
              {clubs.map(c => (
                <Pressable key={c.id}
                  style={[s.clubRow, form.clubId === c.id && s.clubRowActive]}
                  onPress={() => {
                    patch('clubId', c.id);
                    setForm(prev => ({ ...prev, clubName: c.name }));
                    setShowClubPicker(false);
                  }}>
                  <Ionicons name="location" size={18}
                    color={form.clubId === c.id ? colors.primary : colors.textMuted} />
                  <Text style={[s.clubName, form.clubId === c.id && { color: colors.primary, fontFamily: fonts.bold }]}>
                    {c.name}
                  </Text>
                  {form.clubId === c.id && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                </Pressable>
              ))}
            </ScrollView>
            <Button label="Done" variant="ghost" size="md" onPress={() => setShowClubPicker(false)} />
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const s = StyleSheet.create({
  scroll: { padding: spacing.xl, paddingBottom: spacing['3xl'] },
  form:   { gap: spacing.base, marginBottom: spacing.xl },

  fieldGap: { gap: spacing.xs },
  label: { ...ty.labelSm, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  genderRow:    { flexDirection: 'row', gap: spacing.sm },
  genderBtn:    {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  genderBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  genderTxt:       { ...ty.body, color: colors.textMuted },
  genderTxtActive: { color: '#fff', fontFamily: fonts.bold },

  clubPicker: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    paddingHorizontal: spacing.md, height: 50,
  },
  clubPickerTxt: { flex: 1, ...ty.body, color: colors.text },

  error: { ...ty.bodySm, color: colors.error, marginBottom: spacing.md },

  modalScrim:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:  {
    backgroundColor: colors.card, borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing['2xl'],
    maxHeight: '70%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  modalTitle:  { ...ty.h3, color: colors.text, marginBottom: spacing.lg },
  modalList:   { marginBottom: spacing.lg },
  clubRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  clubRowActive: { backgroundColor: colors.primaryBg, marginHorizontal: -spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  clubName:    { flex: 1, ...ty.body, color: colors.text },
});
