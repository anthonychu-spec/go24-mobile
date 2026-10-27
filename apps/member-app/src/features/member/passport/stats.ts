import type { Activity, ActivityItem } from '../../../api/member';
import { brandContent } from '../../../brand';
import { dayParts, hkDateKey, hkTime } from '../../../lib/hkTime';
import { programmeFor } from '../programmes';

// Passport numbers from GET /activity. null = not available (decision B6), never shown as 0.

export const DEFAULT_GOAL = 12;
export const GOAL_MIN = 4;
export const GOAL_MAX = 40;
export const clampGoal = (n: number) => Math.min(GOAL_MAX, Math.max(GOAL_MIN, Math.round(n)));

/** Completed-class milestones (prototype copy) */
export const MILESTONES = [
  { at: 1, title: 'THE FIRST STEP', body: 'Complete your first session.' },
  { at: 5, title: 'BUILDING THE HABIT', body: 'Five visits. A stronger routine.' },
  { at: 10, title: 'DOUBLE FIGURES', body: 'Ten visits. Keep showing up.' },
];

export interface PassportStats {
  visitsThisMonth: number | null;
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
  const month = activity?.summary.thisMonth;
  return {
    visitsThisMonth: month ? month.checkins ?? month.classes : null,
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
