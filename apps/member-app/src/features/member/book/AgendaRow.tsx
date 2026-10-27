import { Pressable, StyleSheet, View } from 'react-native';
import type { GymClass, MyBooking } from '../../../api/member';
import { colors } from '../../../theme';
import { Btn, T, Tag } from '../../../ui/kit';
import { programmeFor } from '../programmes';
import { availability, classWhen, type Tone } from './schedule';

export const toneColor: Record<Tone, string> = {
  normal: colors.textSecond,
  low: colors.cta,
  ok: colors.green,
  warn: colors.amber,
  muted: colors.textMuted,
};

/** One session in the schedule: time, programme, availability, Book / Waitlist / View */
export function AgendaRow({ cls, booking, onOpen, onView }: {
  cls: GymClass; booking?: MyBooking; onOpen: () => void; onView: (bookingId: string) => void;
}) {
  const p = programmeFor(cls.name);
  const w = classWhen(cls);
  const a = availability(cls, booking);
  const press = booking ? () => onView(booking.id) : onOpen;
  const meta = [cls.instructorName, cls.clubName].filter(Boolean).join(' · ');
  // No button role on the row: it holds the Book button, and web can't nest <button>s
  return (
    <Pressable onPress={press} style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]}
      accessibilityLabel={`${p.name}, ${w.time}, ${a.label}`}>
      <View style={s.time}>
        <T v="h3">{w.time}</T>
        <T v="micro" color={colors.textMuted} style={{ marginTop: 5 }}>{w.minutes} MIN</T>
      </View>
      <View style={{ flex: 1 }}>
        {p.pillar ? <Tag>{p.pillar}</Tag> : null}
        <T v="h3" style={{ marginTop: 4, marginBottom: 4 }}>{p.name}</T>
        {meta ? <T v="small" color={colors.textMuted}>{meta}</T> : null}
        <T v="small" color={toneColor[a.tone]} style={{ marginTop: 6 }}>{a.label}</T>
      </View>
      <Btn
        label={a.button}
        kind={a.action === 'book' ? 'primary' : 'ghost'}
        disabled={!a.action}
        onPress={press}
        style={[s.btn, a.action === 'waitlist' && { borderColor: colors.cta }]}
      />
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 18,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  time: { width: 52, alignSelf: 'flex-start', paddingTop: 4 },
  btn: { minHeight: 38, minWidth: 70, paddingHorizontal: 12, paddingVertical: 8 },
});
