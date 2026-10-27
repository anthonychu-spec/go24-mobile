import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../../../theme';
import { Card, Meter, SectionHead, T } from '../../../ui/kit';
import { MetricGrid } from './MetricGrid';
import { ProgressRow } from './ProgressRow';
import { MILESTONES, type PassportStats } from './stats';

/**
 * Goal card (visits / weeks in a row / goal from /me/passport/visits; null = unknown or not set),
 * pillar balance, milestones.
 */
export function Overview({ stats, visits, weeks, goal, onEditGoal }: {
  stats: PassportStats; visits: number | null; weeks: number | null; goal: number | null; onEditGoal: () => void;
}) {
  const left = visits == null || goal == null ? null : Math.max(0, goal - visits);
  const total = stats.classesTotal;
  return (
    <>
      <Card style={s.goal}>
        <View style={s.goalTop}>
          <T v="h3" style={{ flex: 1 }}>{goal == null ? 'SET YOUR PACE.' : 'KEEP THE MOMENTUM.'}</T>
          <Pressable onPress={onEditGoal} hitSlop={10} accessibilityRole="button">
            <T v="small" color={colors.link}>{goal == null ? 'Set a goal' : 'Edit goal'}</T>
          </Pressable>
        </View>
        <T v="stat" style={s.goalNumber}>
          {visits ?? '—'}
          <T v="small" color={colors.textMuted}>{goal == null ? ' visits this month' : ` / ${goal} visits`}</T>
        </T>
        {goal != null ? <Meter value={visits ?? 0} max={goal} /> : null}
        {left != null ? (
          <T v="small" color={colors.textMuted} style={{ marginTop: 13 }}>
            {left === 0 ? 'Goal reached. Set your next target.' : `${left} more ${left === 1 ? 'visit' : 'visits'} to your next target.`}
          </T>
        ) : goal == null ? (
          <T v="small" color={colors.textMuted}>Choose how many visits a month you're aiming for.</T>
        ) : null}
        {weeks ? (
          <T v="small" color={colors.textSecond} style={{ marginTop: 8 }}>
            {`${weeks} ${weeks === 1 ? 'week' : 'weeks'} in a row with a visit.`}
          </T>
        ) : null}
      </Card>

      <SectionHead title="A BALANCED APPROACH." />
      <MetricGrid items={stats.pillars.map((p) => ({ label: p.key, value: p.count }))} />

      <SectionHead title="YOUR MILESTONES." />
      {MILESTONES.map((m) => {
        const done = total != null && total >= m.at;
        return (
          <ProgressRow key={m.at} icon={done ? 'check' : 'star'} done={done} title={m.title} body={m.body}
            right={total == null ? '—' : done ? 'ACHIEVED' : `${total}/${m.at}`} />
        );
      })}
    </>
  );
}

const s = StyleSheet.create({
  goal: { padding: 21, backgroundColor: colors.ctaBg },
  goalTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goalNumber: { fontSize: 47, lineHeight: 56, marginTop: 17, marginBottom: 12 },
});
