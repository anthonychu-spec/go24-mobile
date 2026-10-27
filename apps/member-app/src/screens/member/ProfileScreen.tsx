import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { brand, brandContent } from '../../brand';
import { useAuth } from '../../auth/context';
import { useAsync } from '../../hooks/useAsync';
import { colors } from '../../theme';
import { Icon } from '../../ui/Icon';
import { Loading, Message, Note, Page, PageHead, PhotoCard, Row, T } from '../../ui/kit';
import { ClubSheet } from '../../features/member/ClubSheet';
import { useMemberData } from '../../features/member/MemberData';
import { HelpSheet } from '../../features/member/profile/HelpSheet';
import { MemberCard } from '../../features/member/profile/MemberCard';
import { PersonalSheet } from '../../features/member/profile/PersonalSheet';
import { RemindersSheet } from '../../features/member/profile/RemindersSheet';
import { formatExpiry, loadMemberSummary } from '../../features/member/profile/summary';

type SheetName = 'personal' | 'reminders' | 'club' | 'help';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { upcoming, loading: bookingsLoading, refresh: refreshBookings } = useMemberData();
  const summary = useAsync(loadMemberSummary);
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const content = brandContent!;
  const club = brand.club;
  const data = summary.data;
  const memberCode = data?.memberCode ?? user?.memberCode ?? null;
  const expiry = formatExpiry(data?.expiresAt ?? null);
  const close = () => setSheet(null);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([summary.reload(), refreshBookings()]);
    setRefreshing(false);
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout(); // the route guard takes it to sign-in
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Page refreshing={refreshing} onRefresh={onRefresh}>
      <PageHead
        eyebrow={content.profile.eyebrow}
        title={content.profile.title}
        right={<Icon name="profile" size={24} color={colors.textSecond} />}
      />

      {summary.loading && !data ? <Loading /> : (
        <>
          {summary.error ? <Message text={summary.error} /> : null}
          {data?.incomplete && !summary.error ? <Message tone="info" text="Some details could not be loaded. Pull down to try again." /> : null}
          <MemberCard
            name={data?.name ?? null}
            memberCode={memberCode}
            planName={data?.planName ?? null}
            onPress={() => router.push('/pass')}
          />
          <View style={s.summary}>
            <View style={{ flex: 1 }}>
              <T v="eyebrow" color={colors.textMuted}>YOUR PLAN</T>
              <T v="h3" style={{ marginTop: 6 }}>
                {data?.planName ?? (data?.hasMembership === false ? 'NO CURRENT PLAN' : '—')}
              </T>
            </View>
            <View style={s.status}>
              {data?.active != null ? (
                <T v="micro" color={data.active ? colors.green : colors.amber}>{data.active ? 'ACTIVE' : 'NOT ACTIVE'}</T>
              ) : null}
              {expiry ? <T v="small" color={colors.textMuted}>Until {expiry}</T> : null}
            </View>
          </View>
        </>
      )}

      <View style={{ marginTop: 6 }}>
        <Row
          icon="book"
          label="My bookings"
          detail={bookingsLoading ? undefined : `${upcoming.length} upcoming`}
          onPress={() => router.push({ pathname: '/passport', params: { tab: 'bookings' } })}
        />
        <Row icon="profile" label="Personal details" onPress={() => setSheet('personal')} />
        <Row icon="clock" label="Notifications" onPress={() => setSheet('reminders')} />
        {club ? <Row icon="pin" label="Your club" onPress={() => setSheet('club')} /> : null}
        <Row icon="message" label="Help & first visit" onPress={() => setSheet('help')} />
        {/* TODO(G4): Privacy policy and Terms rows once the brand's URLs exist */}
        <Row icon="logout" label={signingOut ? 'Signing out…' : 'Sign out'} onPress={signOut} />
        <Row icon="trash" label="Delete account" tone="danger" onPress={() => router.push('/account/delete')} />
      </View>

      {club ? (
        <>
          <PhotoCard image={content.profile.image} height={145} dim={0.35} onPress={() => setSheet('club')} style={s.location}>
            <View style={s.locationLabel}>
              <T v="micro" color={colors.textSecond}>{club.name}</T>
            </View>
          </PhotoCard>
          <Note>{[club.address.join('\n'), club.hours.join('\n')].join('\n\n')}</Note>
        </>
      ) : null}

      <PersonalSheet visible={sheet === 'personal'} onClose={close} summary={data} error={summary.error} />
      <RemindersSheet visible={sheet === 'reminders'} onClose={close} />
      <ClubSheet visible={sheet === 'club'} onClose={close} />
      <HelpSheet visible={sheet === 'help'} onClose={close} />
    </Page>
  );
}

const s = StyleSheet.create({
  summary: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  status: { alignItems: 'flex-end', gap: 6 },
  location: { marginTop: 28 },
  locationLabel: { position: 'absolute', left: 14, bottom: 13, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.bg },
});
