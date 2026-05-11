import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, spacing, type as ty, radius } from '../../src/theme';
import { Button, ScreenWrapper, ScreenHeader } from '../../src/components';
import { t } from '../../src/i18n';
import { useSignup } from './_layout';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildDates(): Array<{ iso: string; day: number; month: string; weekday: string; today: boolean }> {
  const result = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    result.push({
      iso:     toISO(d),
      day:     d.getDate(),
      month:   MONTHS[d.getMonth()],
      weekday: DAYS[d.getDay()],
      today:   i === 0,
    });
  }
  return result;
}

export default function SignupStartDate() {
  const router = useRouter();
  const { data, update } = useSignup();
  const dates = buildDates();
  const [selected, setSelected] = useState<string>(data.startDate || dates[0].iso);

  const next = () => {
    update({ startDate: selected });
    router.push('/signup/selfie');
  };

  return (
    <ScreenWrapper>
      <ScreenHeader showBack title={t.signup.startDateTitle} subtitle={t.signup.startDateSub}
        rightLabel="3/5" />

      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.note}>{t.signup.startDateNote}</Text>

        <View style={s.grid}>
          {dates.map(d => (
            <Pressable
              key={d.iso}
              style={[s.cell, selected === d.iso && s.cellSelected]}
              onPress={() => setSelected(d.iso)}
            >
              <Text style={[s.weekday, selected === d.iso && s.textSelected]}>{d.weekday}</Text>
              <Text style={[s.day, selected === d.iso && s.daySelected]}>{d.day}</Text>
              <Text style={[s.month, selected === d.iso && s.textSelected]}>{d.month}</Text>
              {d.today && (
                <View style={[s.todayDot, selected === d.iso && s.todayDotSelected]} />
              )}
            </Pressable>
          ))}
        </View>

        <View style={s.selectedBox}>
          <Text style={s.selectedLabel}>Start date</Text>
          <Text style={s.selectedValue}>
            {(() => {
              const d = dates.find(x => x.iso === selected);
              return d ? `${d.weekday}, ${d.day} ${d.month}` : selected;
            })()}
          </Text>
        </View>

        <Button
          label={t.signup.nextSelfie2}
          variant="primary" size="lg" fullWidth
          onPress={next}
          icon="arrow-forward" iconPosition="right"
        />
      </ScrollView>
    </ScreenWrapper>
  );
}

const s = StyleSheet.create({
  scroll: { padding: spacing.xl, paddingBottom: spacing['3xl'] },
  note:   { ...ty.body, color: colors.textMuted, marginBottom: spacing.xl },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: spacing.sm, marginBottom: spacing.xl,
  },
  cell: {
    width: '13%' as any,
    minWidth: 44,
    flex: 1,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.border,
    gap: 2, position: 'relative',
  },
  cellSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  weekday: { ...ty.caption, color: colors.textMuted },
  day:     { fontSize: 22, fontFamily: fonts.black, color: colors.text },
  month:   { ...ty.caption, color: colors.textMuted },
  textSelected: { color: 'rgba(255,255,255,0.85)' },
  daySelected:  { color: '#fff' },
  todayDot: {
    position: 'absolute', bottom: 6,
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: colors.primary,
  },
  todayDotSelected: { backgroundColor: '#fff' },

  selectedBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderRadius: radius.lg, padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  selectedLabel: { ...ty.body, color: colors.textMuted },
  selectedValue: { ...ty.bodyBold, color: colors.primary },
});
