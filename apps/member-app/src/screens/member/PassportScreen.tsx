import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { activityApi, meApi, type MyBooking } from '../../api/member';
import { brandContent } from '../../brand';
import { useMemberData } from '../../features/member/MemberData';
import { BookingSheet } from '../../features/member/passport/BookingSheet';
import { BookingsTab } from '../../features/member/passport/BookingsTab';
import { GoalSheet } from '../../features/member/passport/GoalSheet';
import { HistoryTab } from '../../features/member/passport/HistoryTab';
import { MetricGrid } from '../../features/member/passport/MetricGrid';
import { Overview } from '../../features/member/passport/Overview';
import { readActivity } from '../../features/member/passport/stats';
import { useAsync } from '../../hooks/useAsync';
import { colors } from '../../theme';
import { Icon } from '../../ui/Icon';
import { Note, Page, PageHead, Segmented } from '../../ui/kit';

type Tab = 'overview' | 'bookings' | 'history';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'history', label: 'History' },
];
const asTab = (v: unknown): Tab | null => (TABS.some((t) => t.key === v) ? (v as Tab) : null);

/** Visits, goal, bookings and class history. Params: ?tab=overview|bookings|history&booking=<id> */
export default function PassportScreen() {
  const content = brandContent!;
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; booking?: string }>();
  const { upcoming, bookings, loading, error, refresh } = useMemberData();
  const passport = useAsync(meApi.passportVisits);
  const activity = useAsync(activityApi.get);

  // Tab follows the route param; picking a tab writes it back so a repeat link still switches
  const [tab, setTab] = useState<Tab>(() => asTab(params.tab) ?? 'overview');
  useEffect(() => {
    const t = asTab(params.tab);
    if (t) setTab(t);
  }, [params.tab]);
  const pickTab = (t: Tab) => {
    setTab(t);
    router.setParams({ tab: t });
  };

  // Sheets remount per open (key) so their step / stepper start fresh
  const [seq, setSeq] = useState(0);
  const [detail, setDetail] = useState<MyBooking | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const openBooking = useCallback((b: MyBooking) => {
    setSeq((n) => n + 1);
    setDetail(b);
    setDetailOpen(true);
  }, []);
  const openGoal = () => {
    setSeq((n) => n + 1);
    setGoalOpen(true);
  };

  // ?booking=<id>: open its detail once bookings are in. A booking made a moment ago on
  // another tab may not be in the shared list yet, so refresh once before giving up.
  const retried = useRef<string | null>(null);
  useEffect(() => {
    const id = params.booking;
    if (!id || loading) return;
    const b = bookings.find((x) => x.id === id);
    if (b) openBooking(b);
    else if (retried.current !== id) {
      retried.current = id;
      void refresh();
      return;
    }
    router.setParams({ booking: undefined });
  }, [params.booking, loading, bookings, openBooking, refresh, router]);

  // Saved goal wins until the visits load again
  const [savedGoal, setSavedGoal] = useState<number | null>(null);
  useEffect(() => { setSavedGoal(null); }, [passport.data]);
  const goal = savedGoal ?? passport.data?.visitGoal ?? null;

  // Decision B6: visit data may be missing; show "—", never 0
  const visits = passport.data?.visitsThisMonth ?? null;
  const visitsUnavailable = !passport.loading && visits == null;
  const historyUnavailable = !!activity.error || !!activity.data?.errors?.length;
  const stats = useMemo(() => readActivity(historyUnavailable ? null : activity.data), [historyUnavailable, activity.data]);
  const upcomingKnown = !loading && !(error && !bookings.length);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), passport.reload(), activity.reload()]);
    setRefreshing(false);
  };
  const explore = () => router.push('/book');

  return (
    <Page refreshing={refreshing} onRefresh={onRefresh}>
      <PageHead eyebrow={content.passport.eyebrow} title={content.passport.title}
        right={<Icon name="passport" size={28} color={colors.textSecond} />} />

      <MetricGrid style={!visitsUnavailable && s.gridGap} items={[
        { label: 'VISITS THIS MONTH', value: visits },
        { label: 'UPCOMING', value: upcomingKnown ? upcoming.length : null },
        { label: 'VISIT GOAL', value: goal },
      ]} />
      {visitsUnavailable ? <View style={s.gridGap}><Note>{"Visits aren't available yet."}</Note></View> : null}

      <Segmented items={TABS} value={tab} onChange={pickTab} spread={false} />
      {tab === 'overview' ? (
        <Overview stats={stats} visits={visits} weeks={passport.data?.weeksInARow ?? null} goal={goal} onEditGoal={openGoal} />
      ) : tab === 'bookings' ? (
        <BookingsTab upcoming={upcoming} loading={loading} error={error} onOpen={openBooking} onExplore={explore} />
      ) : (
        <HistoryTab history={stats.history} unavailable={historyUnavailable} onExplore={explore} />
      )}

      <BookingSheet key={`booking-${seq}`} booking={detail} visible={detailOpen} onClose={() => setDetailOpen(false)} />
      <GoalSheet key={`goal-${seq}`} visible={goalOpen} goal={goal} onClose={() => setGoalOpen(false)}
        onSaved={(g) => { setSavedGoal(g); setGoalOpen(false); }} />
    </Page>
  );
}

const s = StyleSheet.create({
  gridGap: { marginBottom: 21 },
});
