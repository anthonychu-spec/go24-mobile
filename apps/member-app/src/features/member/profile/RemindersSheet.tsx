import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { meApi } from '../../../api/member';
import { apiErrorMessage } from '../../../api/errors';
import { colors } from '../../../theme';
import { Btn, Chip, Loading, Message, Sheet, T } from '../../../ui/kit';

// 0 = no reminder (backend reminderMinutes)
const CHOICES = [
  { minutes: 0, label: 'Off' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 120, label: '2 hours' },
];

/** Class-reminder preference (GET/PATCH /me/settings); loads each time it opens */
export function RemindersSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [saved, setSaved] = useState<number | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let live = true;
    setLoading(true); setError(null); setDone(false);
    meApi.settings()
      .then((s) => { if (live) { setSaved(s.reminderMinutes); setChoice(s.reminderMinutes); } })
      .catch((err) => { if (live) setError(apiErrorMessage(err)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [visible, attempt]);

  async function save() {
    if (choice == null) return;
    setSaving(true); setError(null); setDone(false);
    try {
      const next = await meApi.updateSettings({ reminderMinutes: choice });
      setSaved(next.reminderMinutes);
      setChoice(next.reminderMinutes);
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const loaded = saved != null;
  return (
    <Sheet visible={visible} onClose={onClose} eyebrow="YOUR PREFERENCES" title="FIND YOUR RHYTHM.">
      <T v="label">Class reminders</T>
      <T v="small" color={colors.textMuted} style={{ marginTop: 4 }}>
        Get a reminder before each class you have booked.
      </T>
      {loading && !loaded ? <Loading /> : null}
      {loaded ? (
        <View style={s.choices}>
          {CHOICES.map((c) => (
            <Chip key={c.minutes} label={c.label} on={choice === c.minutes} onPress={() => { setChoice(c.minutes); setDone(false); }} />
          ))}
        </View>
      ) : null}
      {error ? <Message text={error} /> : null}
      {done ? <Message tone="ok" text="Preferences saved." /> : null}
      {loaded ? (
        <Btn label="Save preferences" full onPress={save} loading={saving} disabled={choice === saved} style={{ marginTop: 10 }} />
      ) : !loading && error ? (
        <Btn label="Try again" kind="ghost" full onPress={() => setAttempt((n) => n + 1)} style={{ marginTop: 10 }} />
      ) : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, marginBottom: 6 },
});
