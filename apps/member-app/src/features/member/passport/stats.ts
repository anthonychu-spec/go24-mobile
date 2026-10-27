import { VISIT_GOAL_MAX, VISIT_GOAL_MIN, type Activity, type ActivityItem } from '../../../api/member';
import { brandContent } from '../../../brand';
import { dayParts, hkDateKey, hkTime } from '../../../lib/hkTime';
import { programmeFor } from '../programmes';

// Visit numbers come from GET /me/passport/visits; class history, pillar balance and
// milestones from GET /activity. null = not available (decision B6), never shown as 0.

/** Where the goal stepper starts when the member hasn't set one */
export const DEFAULT_GOAL = 12;
export const GOAL_MIN = VISIT_GOAL_MIN;
export const GOAL_MAX = VISIT_GOAL_MAX;
export const clampGoal = (n: number) => Math.min(GOAL_MAX, Math.max(GOAL_MIN, Math.round(n)));

/** Completed-class milestones (prototype copy) */
export const MILESTONES = [
  { at: 1, title: 'THE FIRST STEP', body: 'Complete your first session.' },
  { at: 5, title: 'BUILDING THE HABIT', body: 'Five visits. A stronger routine.' },
  { at: 10, title: 'DOUBLE FIGURES', body: 'Ten visits. Keep showing up.' },
];

export interface PassportStats {
  classesTotal: number | null;
  /** Completed classes, newest first */
  history: ActivityItem[] | null;
  /** Classes per brand pillar key */
  pillars: { key: string; count: number | null }[];
}

/** Pass null while loading or when the activity can't be trusted */
export function readActivity(activity: Activity | null): PassportStats {
  const history = activity
    ? activity.items
      .filter((i) => i.type === 'class')
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    : null;
  return {
    classesTotal: activity ? activity.summary.classesTotal : null,
    history,
    pillars: brandContent!.pillars.map((p) => ({
      key: p.key,
      count: history ? history.filter((h) => programmeFor(h.title).pillar.includes(p.key)).length : null,
    })),
  };
}

/** 'TUE 20 OCT · 18:30' (Hong Kong time) */
export function classWhen(at: string): string {
  const d = dayParts(hkDateKey(at));
  return `${d.wd} ${d.day} ${d.month} · ${hkTime(at)}`;
}
