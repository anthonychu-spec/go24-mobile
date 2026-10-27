import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { meApi } from '../../api/member';
import { brand, brandContent } from '../../brand';
import { useFeature } from '../../config/AppConfigProvider';
import { BookingCard } from '../../features/member/BookingCard';
import { ClubSheet } from '../../features/member/ClubSheet';
import { useMemberData } from '../../features/member/MemberData';
import { useAsync } from '../../hooks/useAsync';
import { dayParts, hkDateKey } from '../../lib/hkTime';
import { colors } from '../../theme';
import { Icon, type IconName } from '../../ui/Icon';
import { Btn, Card, Message, PAD, Page, PhotoCard, SectionHead, T } from '../../ui/kit';

type Action = { icon: IconName; label: string; onPress: () => void };

export default function HomeScreen() {
  const content = brandContent!;
  const router = useRouter();
  const { upcoming, loading, error, refresh } = useMemberData();
  const profile = useAsync(meApi.profile);
  const recoveryNative = useFeature('recovery_native');
  const recoveryPortal = useFeature('recovery_portal');
  const recoveryOn = recoveryNative || recoveryPortal;
  const coachingOn = useFeature('coaching_enquiry');
  const [clubOpen, setClubOpen] = useState(false);

  const today = dayParts(hkDateKey());
  const firstName = profile.data?.member.firstName ?? profile.data?.member.name?.split(' ')[0];
  const next = upcoming[0];
  const goBook = (params?: Record<string, string>) => router.push({ pathname: '/book', params });

  // Four tiles, like the prototype; Recovery / Coaching only for brands that have them
  const actions: Action[] = [{ icon: 'strength', label: 'Classes', onPress: () => goBook() }];
  if (recoveryOn) actions.push({ icon: 'recovery', label: 'Recovery', onPress: () => goBook({ tab: 'recovery' }) });
  if (coachingOn) actions.push({ icon: 'pt', label: 'Coaching', onPress: () => goBook({ tab: 'coaching' }) });
  actions.push(
    { icon: 'book', label: 'Bookings', onPress: () => router.push({ pathname: '/passport', params: { tab: 'bookings' } }) },
    { icon: 'qr', label: 'Member pass', onPress: () => router.push('/pass') },
  );
  if (brand.club) actions.push({ icon: 'pin', label: 'Club info', onPress: () => setClubOpen(true) });
  actions.splice(4);

  const reload = () => { void refresh(); void profile.reload(); };

  return (
    <Page refreshing={loading && profile.loading} onRefresh={reload} padded={false}>
      <View style={s.pad}>
        <View style={s.head}>
          <View style={{ flex: 1 }}>
            <T v="eyebrow" color={colors.textMuted} style={{ marginBottom: 8 }}>
              {firstName ? `WELCOME BACK, ${firstName.toUpperCase()}` : `WELCOME TO ${brand.name}`}
            </T>
            <T v="h1">{content.home.title}</T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T v="micro" color={colors.textMuted}>{today.wd}</T>
            <T v="h3" style={{ fontSize: 21 }}>{`${today.day} ${today.month}`}</T>
          </View>
        </View>

        <Hero onPress={() => goBook()} />

        <View style={s.actions}>
          {actions.map((a, i) => (
            <Pressable key={a.label} onPress={a.onPress} accessibilityRole="button" style={s.action}>
              <View style={[s.actionIcon, i === 0 && s.actionIconFirst]}>
                <Icon name={a.icon} size={20} color={i === 0 ? colors.onPrimary : colors.textSecond} />
              </View>
              <T v="small" style={{ textAlign: 'center' }}>{a.label}</T>
            </Pressable>
          ))}
        </View>

        <SectionHead
          title="YOUR NEXT SESSION"
          action={upcoming.length ? 'View all ↗' : undefined}
          onAction={() => router.push({ pathname: '/passport', params: { tab: 'bookings' } })}
        />
        {error ? <Message text={error} /> : null}
        {next ? (
          <BookingCard
            booking={next}
            onPress={() => router.push({ pathname: '/passport', params: { tab: 'bookings', booking: next.id } })}
          />
        ) : (
          <Card style={s.emptyNext}>
            <T v="h3">MAKE ROOM FOR PROGRESS.</T>
            <T v="small" color={colors.textMuted} style={{ marginTop: 6, marginBottom: 16 }}>
              Your next session is waiting. Find a time that works for you.
            </T>
            <Btn label="Find a session" icon="arrow" onPress={() => goBook()} style={{ alignSelf: 'flex-start' }} />
          </Card>
        )}
      </View>

      <View style={s.band}>
        <SectionHead title={`${brand.wordmark.title} PROTOCOL`} />
        <View style={s.protocol}>
          {content.pillars.map((p, i) => (
            <PhotoCard key={p.key} image={p.image} height={150} style={s.pillar} onPress={() => goBook({ pillar: p.key })}>
              <T v="micro" style={s.pillarNo}>{`0${i + 1}`}</T>
              <View style={s.pillarText}>
                <T v="h3" style={{ fontSize: 25 }}>{p.key}</T>
                <T v="micro" color={colors.textSecond} style={{ textTransform: 'none', letterSpacing: 0.2 }}>{p.label}</T>
              </View>
            </PhotoCard>
          ))}
        </View>
      </View>

      <View style={s.pad}>
        <Pressable onPress={() => router.push('/passport')} accessibilityRole="link" style={({ pressed }) => [s.strip, pressed && { opacity: 0.85 }]}>
          <Icon name="trend" size={26} color={colors.cta} />
          <View style={{ flex: 1 }}>
            <T v="micro" color={colors.textMuted}>YOUR TRAINING PASSPORT</T>
            <T v="h3" style={{ marginTop: 4 }}>EVERY SESSION COUNTS.</T>
            <T v="small" color={colors.textMuted} style={{ marginTop: 4 }}>Consistency. Milestones. Measurable progress.</T>
          </View>
          <Icon name="chev" size={16} color={colors.textMuted} />
        </Pressable>

        {brand.club ? (
          <>
            <SectionHead title={`THIS IS YOUR ${brand.wordmark.title.replace(/^THE /, '')}.`} action="Club info ↗" onAction={() => setClubOpen(true)} />
            <PhotoCard image={content.clubImage} height={145} onPress={() => setClubOpen(true)}>
              <View style={s.clubLabel}>
                <T v="micro" color={colors.text}>{brand.club.address[1] ?? brand.club.name}</T>
              </View>
            </PhotoCard>
          </>
        ) : null}
      </View>

      <ClubSheet visible={clubOpen} onClose={() => setClubOpen(false)} />
    </Page>
  );
}

function Hero({ onPress }: { onPress: () => void }) {
  const hero = brandContent!.home.hero;
  return (
    <PhotoCard image={hero.image} height={290} style={s.hero} onPress={onPress} dim={0.45}>
      <View style={s.heroTop}>
        <View style={[s.badge, s.badgeRed]}><T v="micro" color={colors.onPrimary}>{hero.badge}</T></View>
        <View style={s.badge}><T v="micro" color={colors.text}>{hero.badgeRight}</T></View>
      </View>
      <View style={s.heroCopy}>
        <T v="eyebrow" color={colors.textSecond} style={{ marginBottom: 9 }}>{hero.eyebrow}</T>
        <T v="h1" style={{ fontSize: 46, lineHeight: 46 }}>{hero.title}</T>
        <T v="small" color={colors.textSecond} style={{ marginTop: 8 }}>{hero.body}</T>
      </View>
      <View style={s.heroGo}><Icon name="arrow" size={18} color={colors.onPrimary} /></View>
    </PhotoCard>
  );
}

const s = StyleSheet.create({
  pad: { paddingHorizontal: PAD },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  hero: { borderBottomWidth: 3, borderBottomColor: colors.primary, marginBottom: 22 },
  heroTop: { position: 'absolute', top: 16, left: 18, right: 18, flexDirection: 'row', justifyContent: 'space-between' },
  badge: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: 'rgba(0,0,0,0.25)' },
  badgeRed: { backgroundColor: colors.primary, borderColor: colors.primaryMid },
  heroCopy: { position: 'absolute', left: 18, right: 70, bottom: 22 },
  heroGo: {
    position: 'absolute', right: 18, bottom: 24, width: 40, height: 40,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderRadius: brand.shape.button,
  },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  action: { flex: 1, alignItems: 'center', gap: 9 },
  actionIcon: {
    height: 48, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.primaryBg, borderRadius: brand.shape.card,
  },
  actionIconFirst: { backgroundColor: colors.primary, borderColor: colors.primaryMid },
  emptyNext: { padding: 20 },
  band: {
    marginTop: 26, paddingHorizontal: PAD, paddingBottom: 24, backgroundColor: colors.cardSoft,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border,
  },
  protocol: { flexDirection: 'row', gap: 8 },
  pillar: { flex: 1, borderBottomWidth: 2, borderBottomColor: colors.primary },
  pillarNo: { position: 'absolute', top: 9, left: 9 },
  pillarText: { position: 'absolute', left: 10, right: 6, bottom: 11 },
  strip: {
    flexDirection: 'row', alignItems: 'center', gap: 15, padding: 19, marginTop: 24,
    borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: colors.primary, backgroundColor: colors.primaryBg,
  },
  clubLabel: { position: 'absolute', left: 14, bottom: 13, backgroundColor: 'rgba(19,19,19,0.8)', paddingHorizontal: 8, paddingVertical: 5 },
});
