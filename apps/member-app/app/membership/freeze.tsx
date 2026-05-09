import { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../src/api/client';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';

const REASONS = ['Travel', 'Medical', 'Personal'];

export default function FreezeScreen() {
  const router = useRouter();
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');
  const [reason,      setReason]      = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(endDate) &&
    reason.length > 0;

  const submit = async () => {
    setSubmitting(true);
    try {
      await apiClient.post('/me/membership/freeze-request', { startDate, endDate, reason });
      Alert.alert(
        'Request Submitted',
        'Your freeze request has been submitted. Staff will review within 2 business days.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not submit. Please try again.');
    } finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={s.title}>Freeze Membership</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.infoCard}>
            <Ionicons name="information-circle-outline" size={18} color={colors.blue} />
            <Text style={s.infoText}>Maximum 90 days. Staff will review within 2 business days.</Text>
          </View>

          <Text style={s.label}>Start Date</Text>
          <TextInput style={s.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />

          <Text style={s.label}>End Date</Text>
          <TextInput style={s.input} value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />

          <Text style={s.label}>Reason</Text>
          <View style={s.chips}>
            {REASONS.map(r => (
              <Pressable
                key={r}
                style={[s.chip, reason === r && s.chipActive]}
                onPress={() => setReason(r)}
              >
                <Text style={[s.chipTxt, reason === r && s.chipTxtActive]}>{r}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[s.btn, (!valid || submitting) && s.btnOff]}
            onPress={submit}
            disabled={!valid || submitting}
          >
            <Text style={s.btnTxt}>{submitting ? 'Submitting…' : 'Submit Request'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  title:    { fontSize: 17, fontFamily: fonts.bold, color: colors.text },
  scroll:   { padding: 20, gap: 12, paddingBottom: 40 },
  infoCard: { flexDirection: 'row', gap: 10, backgroundColor: colors.blueBg, borderRadius: 12, padding: 14, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 13, color: colors.blue, lineHeight: 18 },
  label:    { fontSize: 13, fontFamily: fonts.semibold, color: colors.text },
  input: {
    backgroundColor: colors.card, borderRadius: 12, padding: 14,
    fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border,
  },
  chips:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:        { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  chipActive:  { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  chipTxt:     { fontSize: 14, fontFamily: fonts.semibold, color: colors.textMuted },
  chipTxtActive:{ color: colors.primary },
  btn:    { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnOff: { opacity: 0.4 },
  btnTxt: { fontSize: 16, fontFamily: fonts.bold, color: '#fff' },
});
