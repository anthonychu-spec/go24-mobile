import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { classesApi, type GymClass } from '../../api/member';
import { brandContent } from '../../brand';
import { useFeature } from '../../config/AppConfigProvider';
import { useMemberData } from '../../features/member/MemberData';
import { AgendaRow } from '../../features/member/book/AgendaRow';
import { ClassSheet } from '../../features/member/book/ClassSheet';
import { DayStrip } from '../../features/member/book/DayStrip';
import { FirstVisitCard } from '../../features/member/book/FirstVisit';
import { SCHEDULE_DAYS, isUpcoming, matchesPillar } from '../../features/member/book/schedule';
import { useAsync } from '../../hooks/useAsync';
import { addDays, dayParts, hkDateKey } from '../../lib/hkTime';
import { colors } from '../../theme';
import { Icon } from '../../ui/Icon';
import { Chip, Empty, HScroll, Loading, Message, Page, PageHead, PhotoCard, Segmented, T } from '../../ui/kit';

type Category = 'classes' | 'recovery' | 'coaching';

const byStart = (a: GymClass, b: GymClass) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime();

export default function BookScreen() {
  const content = brandContent!;
  const router = useRouter();
  const { pillar: pillarParam } = useLocalSearchParams<{ pillar?: string }>();
  const { refresh, bookingFor, error: bookingsError } = useMemberData();

  // Categories by feature flag; the switcher only shows when there is a choice
  const classesOn = useFeature('classes');
  const recoveryNative = useFeature('recovery_native');
  const recoveryPortal = useFeature('recovery_portal');
  const coachingOn = useFeature('coaching_enquiry');
  const categories: { key: Category; label: string }[] = [
    ...(classesOn ? [{ key: 'classes' as const, label: 'Classes' }] : []),
    ...(recoveryNative || recoveryPortal ? [{ key: 'recovery' as const, label: 'Recovery' }] : []),
    ...(coachingOn ? [{ key: 'coaching' as const, label: 'Coaching' }] : []),
  ];
  const [category, setCategory] = useState<Category>('classes');
  const current = categories.find((c) => c.key === category)?.key ?? categories[0]?.key;

  const [filter, setFilter] = useState<string | null>(null);
  const today = hkDateKey();
  const days = Array.from({ length: SCHEDULE_DAYS }, (_, i) => addDays(today, i));
  const [picked, setPicked] = useState(today);
  const day = days.includes(picked) ? picked : days[0];

  const { data, error, loading, reload } = useAsync(() => classesApi.week(SCHEDULE_DAYS));

  // Home's pillar cards open Book with ?pillar=; cleared once applied so the same pillar works again
  useEffect(() => {
    const key = typeof pillarParam === 'string' ? pillarParam.toUpperCase() : '';
    if (!key) return;
    if (content.pillars.some((p) => p.key === key)) {
      setFilter(key);
      setCategory('classes');
    }
    router.setParams({ pillar: '' });
  }, [pillarParam, content.pillars, router]);

  // Fresh availability when coming back to the tab (first focus is the initial load)
  const seen = useRef(false);
  useFocusEffect(useCallback(() => {
    if (seen.current) void reload();
    seen.current = true;
  }, [reload]));

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([reload(), refresh()]);
    setRefreshing(false);
  };

  // Class sheet: keyed per opening so its steps reset; follows reloads for live availability
  const [sheet, setSheet] = useState<{ cls: GymClass; key: number } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const openClass = (cls: GymClass) => {
    setSheet((prev) => ({ cls, key: (prev?.key ?? 0) + 1 }));
    setSheetOpen(true);
  };
  const sheetCls = sheet ? (Object.values(data ?? {}).flat().find((c) => c.id === sheet.cls.id) ?? sheet.cls) : null;

  const viewBooking = (bookingId: string) => {
    setSheetOpen(false);
    router.push({ pathname: '/passport', params: { tab: 'bookings', booking: bookingId } });
  };

  const rows = (data?.[day] ?? []).filter((c) => isUpcoming(c) && matchesPillar(c, filter)).sort(byStart);
  const pillar = filter ? content.pillars.find((p) => p.key === filter) : undefined;
  const d = dayParts(day);

  return (
    <Page refreshing={refreshing} onRefresh={onRefresh}>
      <PageHead eyebrow={content.book.eyebrow} title={content.book.title} right={<Icon name="book" size={22} color={colors.text} />} />

      {categories.length > 1 && current ? <Segmented items={categories} value={current} onChange={setCategory} /> : null}

      {current === 'classes' ? (
        <>
          <PhotoCard image={pillar?.image ?? content.book.banner.image} height={132} dim={0.7} style={s.banner}>
            <View style={s.bannerText}>
              <T v="eyebrow" color={colors.onPrimary} style={{ opacity: 0.85 }}>{content.book.banner.eyebrow}</T>
              <T v="h2" color={colors.onPrimary} style={s.bannerTitle}>
                {pillar ? `${pillar.key}. EVOLVE. REPEAT.` : content.book.banner.title}
              </T>
            </View>
          </PhotoCard>

          <DayStrip days={days} value={day} onChange={setPicked} />

          <View style={s.chips}>
            <HScroll gap={7}>
              <Chip label="All sessions" on={!filter} onPress={() => setFilter(null)} />
              {content.pillars.map((p) => (
                <Chip key={p.key} label={p.key} on={filter === p.key} onPress={() => setFilter(p.key)} />
              ))}
            </HScroll>
          </View>

          {!data && loading ? (
            <Loading label="Loading sessions" />
          ) : !data ? (
            <Empty title="SCHEDULE UNAVAILABLE." body={error ?? undefined} action="Try again" onAction={reload} />
          ) : (
            <>
              {error ? <Message text={error} />
                : bookingsError ? <Message text={`Couldn’t load your bookings. ${bookingsError}`} /> : null}
              <View style={s.summary}>
                <T v="micro" color={colors.textMuted}>
                  {`${rows.length} ${rows.length === 1 ? 'SESSION' : 'SESSIONS'} · ${d.wd} ${d.day} ${d.month}`}
                </T>
                <T v="micro" color={colors.textMuted}>HONG KONG TIME</T>
              </View>
              {rows.length ? rows.map((c) => (
                <AgendaRow key={c.id} cls={c} booking={bookingFor(c.id)} onOpen={() => openClass(c)} onView={viewBooking} />
              )) : (
                <Empty
                  icon="clock"
                  title="A DIFFERENT TIME, SAME INTENT."
                  body={filter ? 'No upcoming sessions match this selection.' : 'No more sessions on this day. Try another date.'}
                  action={filter ? 'Show all sessions' : undefined}
                  onAction={() => setFilter(null)}
                />
              )}
            </>
          )}
        </>
      ) : current === 'recovery' ? (
        <Empty icon="recovery" title="RESET. COME BACK STRONGER." body="Talk to the club team to book your recovery session." />
      ) : current === 'coaching' ? (
        <Empty icon="pt" title="YOUR GOALS. A PLAN THAT’S YOURS." body="Talk to the club team to arrange a coaching consultation." />
      ) : (
        <Empty icon="book" title="NOTHING TO BOOK HERE YET." body="Talk to the club team to book your next session." />
      )}

      <FirstVisitCard />

      {sheet && sheetCls ? (
        <ClassSheet
          key={sheet.key}
          cls={sheetCls}
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onChanged={() => { void reload(); }}
          onViewBooking={viewBooking}
        />
      ) : null}
    </Page>
  );
}

const s = StyleSheet.create({
  banner: { marginBottom: 17 },
  bannerText: { position: 'absolute', left: 19, right: 19, bottom: 18 },
  bannerTitle: { fontSize: 30, lineHeight: 32, marginTop: 7 },
  chips: { marginTop: 16, marginBottom: 19 },
  summary: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
});
