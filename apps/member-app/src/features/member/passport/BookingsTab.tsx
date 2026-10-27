import { View } from 'react-native';
import type { MyBooking } from '../../../api/member';
import { Empty, Loading, Message, SectionHead } from '../../../ui/kit';
import { BookingCard } from '../BookingCard';

/** Upcoming bookings, then the waitlist */
export function BookingsTab({ upcoming, loading, error, onOpen, onExplore }: {
  upcoming: MyBooking[]; loading: boolean; error: string | null;
  onOpen: (b: MyBooking) => void; onExplore: () => void;
}) {
  if (loading) return <Loading />;
  // Without a list an empty state would be wrong
  if (error && !upcoming.length) return <Message text={error} />;
  const held = upcoming.filter((b) => b.status !== 'waitlist');
  const waiting = upcoming.filter((b) => b.status === 'waitlist');
  const cards = (list: MyBooking[]) => (
    <View style={{ gap: 10 }}>
      {list.map((b) => <BookingCard key={b.id} booking={b} onPress={() => onOpen(b)} />)}
    </View>
  );
  return (
    <>
      {error ? <Message text={error} /> : null}
      {held.length ? cards(held) : (
        <Empty icon="book" title="YOUR NEXT CHAPTER IS OPEN." body="Find your next training session."
          action="Explore sessions" onAction={onExplore} />
      )}
      {waiting.length ? (
        <>
          <SectionHead title="ON THE WAITLIST." />
          {cards(waiting)}
        </>
      ) : null}
    </>
  );
}
