import { StyleSheet, View } from 'react-native';
import type { MyBooking } from '../../api/member';
import { dayParts, hkDateKey, hkTime, minutesBetween } from '../../lib/hkTime';
import { colors } from '../../theme';
import { Icon } from '../../ui/Icon';
import { Card, Pill, T, Tag } from '../../ui/kit';
import { programmeFor } from './programmes';

/** Status line for a booking, as members should read it */
export function bookingStatus(b: MyBooking): { label: string; tone: 'ok' | 'warn' | 'muted' } {
  switch (b.status) {
    case 'confirmed': return { label: 'CONFIRMED', tone: 'ok' };
    case 'waitlist': return { label: b.waitlistPosition ? `WAITLIST · #${b.waitlistPosition}` : 'WAITLIST', tone: 'warn' };
    case 'pending':
    case 'pending_verify': return { label: 'CONFIRMING…', tone: 'muted' };
    case 'attended': return { label: 'COMPLETED', tone: 'ok' };
    case 'cancelled': return { label: 'CANCELLED', tone: 'muted' };
    default: return { label: b.status.toUpperCase().replace('_', ' '), tone: 'muted' };
  }
}

/** Date column + programme + time + status (Home "next session", Passport bookings) */
export function BookingCard({ booking, onPress }: { booking: MyBooking; onPress?: () => void }) {
  const p = programmeFor(booking.className);
  const d = booking.startTime ? dayParts(hkDateKey(booking.startTime)) : null;
  const status = bookingStatus(booking);
  const mins = booking.startTime && booking.endTime ? minutesBetween(booking.startTime, booking.endTime) : null;
  return (
    <Card accent onPress={onPress} style={s.card}>
      <View style={s.date}>
        <T v="micro" color={colors.textMuted}>{d?.wd ?? '—'}</T>
        <T v="h2" style={{ fontSize: 30, lineHeight: 32, marginVertical: 2 }}>{d?.day ?? ''}</T>
        <T v="micro" color={colors.textMuted}>{d?.month ?? ''}</T>
      </View>
      <View style={{ flex: 1 }}>
        {p.pillar ? <Tag>{p.pillar}</Tag> : null}
        <T v="h3" style={{ marginVertical: 4 }}>{booking.className ? p.name : 'SESSION'}</T>
        <T v="small" color={colors.textMuted}>
          {[booking.startTime ? hkTime(booking.startTime) : null, mins ? `${mins} min` : null, booking.clubName].filter(Boolean).join(' · ')}
        </T>
        <Pill label={status.label} tone={status.tone} />
      </View>
      {onPress ? <Icon name="chev" size={16} color={colors.textMuted} /> : null}
    </Card>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 15 },
  date: { width: 48, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.border, paddingRight: 12 },
});
