import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { BookResult, GymClass } from '../../../api/member';
import { apiErrorCode, apiErrorMessage } from '../../../api/errors';
import { brand } from '../../../brand';
import { t } from '../../../i18n';
import { colors } from '../../../theme';
import { Icon, type IconName } from '../../../ui/Icon';
import { Btn, DetailRow, Message, Note, Sheet, T } from '../../../ui/kit';
import { useMemberData } from '../MemberData';
import { programmeFor } from '../programmes';
import { availability, classWhen, hasWaitlist, isFull, opensLabel, resultErrorMessage } from './schedule';

type Step = 'detail' | 'review' | 'done';
/** BOOKING_FULL from the server: the class filled up, or the waitlist did too */
type ServerFull = 'class' | 'all' | null;

const PLACED = new Set(['confirmed', 'waitlist', 'pending', 'pending_verify']);

/** Class details → review → result, in one sheet. Remount (key) per opening to reset. */
export function ClassSheet({ cls, visible, onClose, onChanged, onViewBooking }: {
  cls: GymClass; visible: boolean; onClose: () => void;
  /** Availability may have changed (reload the schedule) */
  onChanged: () => void;
  onViewBooking: (bookingId: string) => void;
}) {
  const { book, bookingFor } = useMemberData();
  const [step, setStep] = useState<Step>('detail');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverFull, setServerFull] = useState<ServerFull>(null);
  const [result, setResult] = useState<BookResult | null>(null);

  const p = programmeFor(cls.name);
  const w = classWhen(cls);
  const booking = bookingFor(cls.id);
  const a = availability(cls, booking);
  const opens = opensLabel(cls);
  const full = isFull(cls) || serverFull !== null;
  const canBook = !booking && !opens && (!full || (hasWaitlist(cls) && serverFull !== 'all'));
  const where = cls.clubName ?? brand.club?.name ?? '';
  const when = `${w.time} · ${w.minutes} minutes`;

  const onFull = (acceptWaitlist: boolean) => {
    const all = acceptWaitlist || !hasWaitlist(cls);
    setServerFull(all ? 'all' : 'class');
    setError(acceptWaitlist ? 'The waitlist for this session is full.' : all ? 'This session is fully booked.' : resultErrorMessage('BOOKING_FULL'));
  };

  const submit = async () => {
    const acceptWaitlist = full;
    setSending(true);
    setError(null);
    try {
      const r = await book(cls.id, acceptWaitlist);
      if (r.success && PLACED.has(r.status)) {
        setResult(r);
        setStep('done');
      } else if (r.error === 'BOOKING_FULL') {
        onFull(acceptWaitlist);
      } else {
        setError(resultErrorMessage(r.error));
      }
    } catch (err) {
      if (apiErrorCode(err) === 'BOOKING_FULL') onFull(acceptWaitlist);
      else setError(apiErrorMessage(err));
    } finally {
      setSending(false);
      onChanged();
    }
  };

  const head =
    step === 'detail' ? { eyebrow: p.pillar ? `${p.pillar} · GROUP TRAINING` : 'GROUP TRAINING', title: p.name }
    : step === 'review' ? { eyebrow: full ? 'JOIN THE WAITLIST' : 'YOUR NEXT SESSION', title: 'BOOK WITH INTENT.' }
    : {};

  return (
    <Sheet visible={visible} onClose={sending ? () => {} : onClose} {...head}>
      {step === 'detail' ? (
        <>
          <Image source={p.image} style={s.img} resizeMode="cover" accessibilityIgnoresInvertColors />
          {p.description ? <T v="body" color={colors.textMuted} style={{ marginBottom: 14 }}>{p.description}</T> : null}
          <DetailRow label="When" value={`${w.long}\n${when}`} />
          <DetailRow label="Coach & location" value={[cls.instructorName, where].filter(Boolean).join(' · ') || '—'} />
          <DetailRow label="Availability" value={a.label} />
          {booking ? (
            <Btn full label="View in Passport" icon="arrow" kind="ghost" onPress={() => onViewBooking(booking.id)} style={s.cta} />
          ) : canBook ? (
            <Btn full label={full ? 'Join waitlist' : 'Review booking'} icon="arrow" onPress={() => setStep('review')} style={s.cta} />
          ) : (
            <Note>{opens ? t.errors.outsideWindow : 'This session is fully booked. Try another time.'}</Note>
          )}
        </>
      ) : null}

      {step === 'review' ? (
        <>
          <DetailRow label="Session" value={p.name} />
          <DetailRow label="Date" value={w.long} />
          <DetailRow label="Time" value={when} />
          <DetailRow label="Location" value={where || '—'} />
          {error ? <Message text={error} />
            : full ? <Message tone="info" text="This session is full. Joining the waitlist does not confirm a place." /> : null}
          <Note>You can cancel from Passport → Bookings.</Note>
          {canBook ? (
            <Btn full label={full ? 'Join waitlist' : 'Confirm booking'} icon={full ? undefined : 'check'}
              loading={sending} onPress={submit} style={s.cta} />
          ) : null}
        </>
      ) : null}

      {step === 'done' && result ? (
        <Done result={result} lines={[p.name, `${w.long} · ${when}`, where]}
          onView={() => onViewBooking(result.bookingId)} onClose={onClose} />
      ) : null}
    </Sheet>
  );
}

const DONE: Record<'confirmed' | 'waitlist' | 'pending', { icon: IconName; fg: string; bg: string; eyebrow: string; title: string; body?: string }> = {
  confirmed: {
    icon: 'check', fg: colors.green, bg: colors.greenBg,
    eyebrow: 'BOOKING CONFIRMED', title: `WE’LL SEE YOU IN ${brand.name.toUpperCase()}.`,
  },
  waitlist: {
    icon: 'clock', fg: colors.amber, bg: colors.amberBg,
    eyebrow: 'WAITLIST', title: 'YOU’RE ON THE WAITLIST.',
    body: 'Your place is not confirmed yet. Check Passport → Bookings for updates.',
  },
  pending: {
    icon: 'clock', fg: colors.textMuted, bg: colors.cardSoft,
    eyebrow: 'BOOKING RECEIVED', title: 'CONFIRMING YOUR PLACE.',
    body: 'We’re confirming your place with the club. Check Passport → Bookings shortly.',
  },
};

function Done({ result, lines, onView, onClose }: { result: BookResult; lines: string[]; onView: () => void; onClose: () => void }) {
  const d = DONE[result.status === 'confirmed' || result.status === 'waitlist' ? result.status : 'pending'];
  return (
    <View accessibilityLiveRegion="polite">
      <View style={[s.mark, { backgroundColor: d.bg, borderColor: d.fg }]}>
        <Icon name={d.icon} size={26} color={d.fg} />
      </View>
      <T v="eyebrow" color={colors.cta}>{d.eyebrow}</T>
      <T v="h1" style={s.title}>{d.title}</T>
      {d.body ? <T v="body" color={colors.textSecond} style={{ marginBottom: 12 }}>{d.body}</T> : null}
      <View style={s.lines}>
        {lines.filter(Boolean).map((line) => <T key={line} v="body" color={colors.textMuted}>{line}</T>)}
      </View>
      <Btn full label="View my bookings" icon="arrow" onPress={onView} />
      <Btn full label="Done" kind="ghost" onPress={onClose} style={{ marginTop: 9 }} />
    </View>
  );
}

const s = StyleSheet.create({
  img: { width: '100%', height: 150, marginBottom: 18, borderRadius: brand.shape.card },
  cta: { marginTop: 20 },
  mark: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 6, marginBottom: 18 },
  title: { fontSize: 36, lineHeight: 38, marginTop: 8, marginBottom: 14, paddingRight: 30 },
  lines: { marginBottom: 22 },
});
