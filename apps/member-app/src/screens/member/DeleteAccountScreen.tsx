import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { meApi } from '../../api/member';
import { apiErrorMessage } from '../../api/errors';
import { brand } from '../../brand';
import { useAuth } from '../../auth/context';
import { colors, fonts } from '../../theme';
import { Icon } from '../../ui/Icon';
import { Btn, Message, T } from '../../ui/kit';
import { FullPage, useLeave } from '../../features/member/profile/FullPage';

// One app account across the group's apps (backend plan N4), so deleting it reaches all three
const GROUP_APPS = 'THE LAB, The Foundry and GO24';
const CONFIRM = 'DELETE';

const REMOVED = [
  'Your sign-in history',
  'Saved settings, such as class reminders',
  'Notification tokens for your devices',
  'Booking records kept in the app',
];

export default function DeleteAccountScreen() {
  const router = useRouter();
  const leave = useLeave();
  const { logout } = useAuth();
  const [typed, setTyped] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const club = brand.club;
  const confirmed = typed.trim() === CONFIRM;

  async function remove() {
    if (!confirmed || sending) return;
    setSending(true);
    setError(null);
    try {
      // Planned endpoint POST /v1/me/account/deletion (the mock API accepts it)
      await meApi.deleteAccount();
    } catch (err) {
      setError(apiErrorMessage(err));
      setSending(false);
      return;
    }
    try {
      await logout();
    } catch {
      // The account is gone server-side either way; still leave the signed-in area
    }
    router.replace('/(auth)/login');
  }

  return (
    <FullPage action="back">
      <T v="eyebrow" color={colors.error}>YOUR ACCOUNT</T>
      <T v="h1" style={s.title}>DELETE ACCOUNT.</T>

      <T v="body" color={colors.textSecond}>
        This deletes your app account and its data for the {GROUP_APPS} apps. You use one account across the group's apps, so it closes in all of them.
      </T>

      <View style={s.block}>
        <T v="eyebrow" color={colors.textMuted}>REMOVED OR ANONYMISED</T>
        {REMOVED.map((line) => (
          <View key={line} style={s.item}>
            <View style={s.bullet} />
            <T v="body" style={{ flex: 1 }}>{line}</T>
          </View>
        ))}
      </View>

      <View style={[s.block, s.keep]}>
        <View style={s.keepHead}>
          <Icon name="shield" size={18} color={colors.cta} />
          {/* The membership lives in PGM; members know it as their club membership */}
          <T v="label" style={{ flex: 1 }}>Your club membership is not cancelled.</T>
        </View>
        <T v="body" color={colors.textSecond} style={{ marginTop: 8 }}>
          Deleting the app account leaves your membership as it is. To end your membership, contact the club team{club ? ':' : '.'}
        </T>
        {club ? (
          <View style={{ marginTop: 8 }}>
            <T v="label">{club.name}</T>
            {club.address.map((line) => <T key={line} v="body" color={colors.textSecond}>{line}</T>)}
          </View>
        ) : null}
      </View>

      <T v="label" style={{ marginTop: 26 }}>Type {CONFIRM} to confirm</T>
      <TextInput
        value={typed}
        onChangeText={setTyped}
        placeholder={CONFIRM}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        editable={!sending}
        returnKeyType="done"
        onSubmitEditing={remove}
        style={s.input}
        accessibilityLabel={`Type ${CONFIRM} to confirm`}
      />

      {error ? <Message text={error} /> : null}

      <Btn label="Delete my account" kind="danger" icon="trash" full onPress={remove} loading={sending} disabled={!confirmed} style={{ marginTop: 14 }} />
      <Btn label="Keep my account" kind="ghost" full onPress={leave} disabled={sending} style={{ marginTop: 10 }} />
    </FullPage>
  );
}

const s = StyleSheet.create({
  title: { marginTop: 8, marginBottom: 18 },
  block: { marginTop: 22, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border, gap: 4 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 6 },
  bullet: { width: 5, height: 5, marginTop: 8, backgroundColor: colors.textMuted },
  keep: { borderLeftWidth: 3, borderLeftColor: colors.cta, borderTopWidth: 0, paddingTop: 2, paddingLeft: 14 },
  keepHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    marginTop: 8, minHeight: 46, paddingHorizontal: 13, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.border, borderRadius: brand.shape.button, backgroundColor: colors.card,
    color: colors.text, fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 1.5,
  },
});
