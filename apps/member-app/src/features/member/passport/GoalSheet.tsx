import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { meApi } from '../../../api/member';
import { apiErrorCode, apiErrorMessage } from '../../../api/errors';
import { brand } from '../../../brand';
import { colors } from '../../../theme';
import { Btn, Message, Sheet, T } from '../../../ui/kit';
import { clampGoal, DEFAULT_GOAL, GOAL_MAX, GOAL_MIN } from './stats';

/** Monthly visit goal stepper. Remount (key) per open so it starts from the current goal. */
export function GoalSheet({ visible, goal, onClose, onSaved }: {
  visible: boolean; goal: number | null; onClose: () => void; onSaved: (goal: number) => void;
}) {
  const [value, setValue] = useState(() => clampGoal(goal ?? DEFAULT_GOAL));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const step = (d: number) => setValue((v) => clampGoal(v + d));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await meApi.updateSettings({ visitGoal: value });
      // An older server drops unknown fields; that must not look saved
      if (next?.visitGoal !== value) throw new Error('visitGoal not stored');
      onSaved(value);
    } catch (err) {
      setError(apiErrorCode(err) === 'UNKNOWN' ? "Your goal couldn't be saved. Please try again later." : apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} eyebrow="YOUR CONSISTENCY GOAL" title="SET YOUR OWN PACE.">
      <T v="body" color={colors.textSecond}>{"Choose how many visits you're aiming for each month."}</T>
      <View style={s.stepper}>
        <StepButton label="−" a11y="Fewer visits" disabled={value <= GOAL_MIN} onPress={() => step(-1)} />
        <View style={s.value} accessible accessibilityRole="adjustable" accessibilityLabel="Visit goal"
          accessibilityValue={{ min: GOAL_MIN, max: GOAL_MAX, now: value, text: `${value} visits a month` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}>
          <T v="stat" style={s.number}>{value}</T>
          <T v="micro" color={colors.textMuted}>VISITS A MONTH</T>
        </View>
        <StepButton label="+" a11y="More visits" disabled={value >= GOAL_MAX} onPress={() => step(1)} />
      </View>
      {error ? <Message text={error} /> : null}
      <Btn label="Save goal" full loading={busy} onPress={save} style={{ marginTop: 8 }} />
    </Sheet>
  );
}

function StepButton({ label, a11y, disabled, onPress }: { label: string; a11y: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={disabled ? undefined : onPress} accessibilityRole="button" accessibilityLabel={a11y}
      accessibilityState={{ disabled }} hitSlop={6}
      style={({ pressed }) => [s.stepBtn, { opacity: disabled ? 0.35 : pressed ? 0.7 : 1 }]}>
      <T v="h2">{label}</T>
    </Pressable>
  );
}

const s = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 24 },
  value: { flex: 1, alignItems: 'center' },
  number: { fontSize: 56, lineHeight: 60 },
  stepBtn: {
    width: 52, height: 52, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: brand.shape.button,
  },
});
