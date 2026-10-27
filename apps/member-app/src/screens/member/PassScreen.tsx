import { StyleSheet, View } from 'react-native';
import { brand } from '../../brand';
import { useAuth } from '../../auth/context';
import { useFeature } from '../../config/AppConfigProvider';
import { useAsync } from '../../hooks/useAsync';
import { colors } from '../../theme';
import { Btn, DetailRow, Loading, Message, T } from '../../ui/kit';
import { FullPage } from '../../features/member/profile/FullPage';
import { MemberQr } from '../../features/member/profile/MemberQr';
import { loadMemberSummary } from '../../features/member/profile/summary';

// v1: the member number is the pass. The signed QR only shows when the brand turns on member_qr.
export default function PassScreen() {
  const { user } = useAuth();
  const qrOn = useFeature('member_qr');
  const summary = useAsync(loadMemberSummary);
  const data = summary.data;
  const memberCode = data?.memberCode ?? user?.memberCode ?? null;

  return (
    <FullPage action="close">
      <T v="eyebrow" color={colors.cta}>YOUR MEMBER PASS</T>
      <T v="h1" style={s.title}>YOU BELONG HERE.</T>

      {qrOn ? <MemberQr /> : null}

      {memberCode ? (
        <View style={s.panel} accessible accessibilityLabel={`Member number ${memberCode.split('').join(' ')}`}>
          <T v="micro" color={colors.bg}>MEMBER NO.</T>
          <T v="stat" color={colors.bg} style={s.number} adjustsFontSizeToFit numberOfLines={1}>{memberCode}</T>
        </View>
      ) : summary.loading ? <Loading /> : !summary.error ? (
        <Message tone="info" text="Your member number isn't available yet. Please ask the club team." />
      ) : null}
      {!qrOn && memberCode ? (
        <T v="micro" color={colors.textMuted} style={s.caption}>Show your member number at the front desk.</T>
      ) : null}

      {summary.error ? (
        <View style={{ marginTop: 8 }}>
          <Message text={summary.error} />
          <Btn label="Try again" kind="ghost" onPress={summary.reload} loading={summary.loading} />
        </View>
      ) : null}

      {data ? (
        <View style={{ marginTop: 18 }}>
          <DetailRow label="Member" value={data?.name ?? '—'} />
          <DetailRow label="Membership" value={data?.planName ?? '—'} />
        </View>
      ) : null}

      <T v="body" color={colors.textMuted} style={{ marginTop: 18 }}>
        Your member pass sits at the centre of the app, ready whenever you need it.
      </T>
    </FullPage>
  );
}

const s = StyleSheet.create({
  title: { marginTop: 8, marginBottom: 22 },
  // Inverted panel: light on dark brands, so the number reads like a card at the desk
  panel: { backgroundColor: colors.text, paddingVertical: 22, paddingHorizontal: 20, alignItems: 'center', borderRadius: brand.shape.card },
  number: { fontSize: 72, lineHeight: 76, letterSpacing: 4, marginTop: 6 },
  caption: { marginTop: 12, textAlign: 'center' },
});
