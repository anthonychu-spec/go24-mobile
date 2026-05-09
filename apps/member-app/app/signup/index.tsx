import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import { useSignup } from './_layout';

export default function SignupStep1() {
  const router = useRouter();
  const { data, update } = useSignup();
  const [form, setForm] = useState({
    firstName: data.firstName, lastName: data.lastName,
    email: data.email, phone: data.phone, dateOfBirth: data.dateOfBirth,
  });
  const [error, setError] = useState('');

  const valid =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    form.email.includes('@') &&
    form.phone.trim().length >= 8 &&
    /^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth);

  const next = () => {
    if (!valid) { setError('Please fill all fields correctly'); return; }
    update(form);
    router.push('/signup/plan');
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.topRow}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={s.back}>← Back</Text>
            </Pressable>
            <Text style={s.step}>Step 1 of 4</Text>
          </View>

          <Text style={s.title}>Personal Details</Text>
          <Text style={s.sub}>Tell us a bit about yourself</Text>

          <View style={s.form}>
            {[
              { label: 'First Name',    key: 'firstName',   placeholder: 'John',              keyboard: 'default'       },
              { label: 'Last Name',     key: 'lastName',    placeholder: 'Doe',               keyboard: 'default'       },
              { label: 'Email',         key: 'email',       placeholder: 'john@example.com',  keyboard: 'email-address' },
              { label: 'Phone',         key: 'phone',       placeholder: '+852 9123 4567',    keyboard: 'phone-pad'     },
              { label: 'Date of Birth', key: 'dateOfBirth', placeholder: '1990-01-31',        keyboard: 'default', hint: 'Format: YYYY-MM-DD' },
            ].map(f => (
              <View key={f.key} style={s.field}>
                <Text style={s.label}>{f.label}</Text>
                {f.hint && <Text style={s.hint}>{f.hint}</Text>}
                <TextInput
                  style={s.input}
                  value={(form as any)[f.key]}
                  onChangeText={v => setForm(prev => ({ ...prev, [f.key]: f.key === 'email' ? v.toLowerCase() : v }))}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.textMuted}
                  keyboardType={f.keyboard as any}
                  autoCapitalize={f.key === 'email' ? 'none' : 'words'}
                />
              </View>
            ))}
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <Pressable style={[s.btn, !valid && s.btnOff]} onPress={next} disabled={!valid}>
            <Text style={s.btnTxt}>Next: Choose Plan →</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
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
  sub:    { fontSize: 14, color: colors.textMuted, fontFamily: fonts.regular, marginBottom: 24 },
  form:   { gap: 14, marginBottom: 20 },
  field:  { gap: 4 },
  label:  { fontSize: 13, fontFamily: fonts.semibold, color: colors.text },
  hint:   { fontSize: 11, color: colors.textMuted, fontFamily: fonts.regular },
  input: {
    backgroundColor: colors.card, borderRadius: 12, padding: 14,
    fontSize: 15, fontFamily: fonts.regular, color: colors.text,
    borderWidth: 1, borderColor: colors.border,
  },
  error:  { fontSize: 13, color: colors.error, fontFamily: fonts.regular, marginBottom: 12 },
  btn:    { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnOff: { opacity: 0.4 },
  btnTxt: { fontSize: 16, fontFamily: fonts.bold, color: '#fff' },
});
