import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { MyBooking } from '../../../api/member';
import { apiErrorMessage } from '../../../api/errors';
import { brand } from '../../../brand';
import { dayParts, hkDateKey, hkTime, minutesBetween } from '../../../lib/hkTime';
import { colors } from '../../../theme';
import { Btn, DetailRow, Message, Note, Sheet, T } from '../../../ui/kit';
import { bookingStatus } from '../BookingCard';
import { useMemberData } from '../MemberData';
import { programmeFor } from '../programmes';

type Step = 'detail' | 'confirm' | 'done';

/** Booking detail with an in-sheet cancel confirmation. Remount (key) per open to reset the step. */
export function BookingSheet({ booking, visible, onClose }: {
  booking: MyBooking | null; visible: boolean; onClose: () => void;
}) {
  const { upcoming, cancel } = useMemberData();
  const [step, setStep] = useState<Step>('detail');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!booking) return null;

  const p = programmeFor(booking.className);
  const waitlist = booking.status === 'waitlist';
  const canCancel = upcoming.some((u) => u.id === booking.id);
  const start = booking.startTime;
  const mins = start && booking.endTime ? minutesBetween(start, booking.endTime) : null;
  const date = start ? dayParts(hkDateKey(start)).long : null;
  const time = start ? hkTime(start) : null;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await cancel(booking.id);
      setStep('done');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const head = step === 'detail'
    ? { eyebrow: bookingStatus(booking).label, title: p.name }
    : step === 'confirm'
      ? { eyebrow: 'YOUR BOOKING', title: 'CHANGE OF PLAN?' }
      : { eyebrow: 'YOUR BOOKING', title: waitlist ? 'OFF THE WAITLIST.' : 'BOOKING CANCELLED.' };
  const when = [p.name, date, time].filter(Boolean).join(' · ');
  const session = `${p.name}${date ? ` on ${date}` : ''}${time ? ` at ${time}` : ''}`;

  return (
    <Sheet visible={visible} onClose={onClose} eyebrow={head.eyebrow} title={head.title}>
      {step === 'detail' ? (
        <>
          <DetailRow label="Date" value={date ?? '—'} />
          <DetailRow label="Time" value={time ? [time, mins ? `${mins} minutes` : null].filter(Boolean).join(' · ') : '—'} />
          {booking.instructorName ? <DetailRow label="Coach" value={booking.instructorName} /> : null}
          <DetailRow label="Location" value={booking.clubName ?? brand.club?.name ?? '—'} />
          <T v="body" color={colors.textSecond} style={s.copy}>
            {waitlist ? 'Your place is not confirmed yet.' : 'Arrive a little early and check in with the club team.'}
          </T>
          {canCancel ? (
            <Btn label={waitlist ? 'Leave waitlist' : 'Cancel booking'} kind="ghost" full onPress={() => setStep('confirm')} />
          ) : null}
        </>
      ) : step === 'confirm' ? (
        <>
          <T v="body" color={colors.textSecond}>{waitlist ? 'Leave the waitlist for this session?' : 'Cancel this booking?'}</T>
          <T v="label" style={{ marginTop: 6 }}>{when}</T>
          {!waitlist ? <Note>{"Your membership's cancellation rules apply."}</Note> : null}
          {error ? <Message text={error} /> : null}
          <View style={s.actions}>
            <Btn label={waitlist ? 'Leave waitlist' : 'Cancel booking'} kind="danger" full loading={busy} onPress={confirm} />
            <Btn label={waitlist ? 'Stay on the waitlist' : 'Keep my booking'} kind="ghost" full disabled={busy}
              onPress={() => { setStep('detail'); setError(null); }} />
          </View>
        </>
      ) : (
        <>
          <Message tone="ok" text={waitlist ? `You've left the waitlist for ${session}.` : `Your booking for ${session} is cancelled.`} />
          <Btn label="Done" full onPress={onClose} style={{ marginTop: 14 }} />
        </>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  copy: { marginTop: 13, marginBottom: 21 },
  actions: { gap: 9, marginTop: 21 },
});
