import type { ActivityItem } from '../../../api/member';
import { Empty, Loading } from '../../../ui/kit';
import { programmeFor } from '../programmes';
import { ProgressRow } from './ProgressRow';
import { classWhen } from './stats';

/** Completed classes, newest first */
export function HistoryTab({ history, unavailable, onExplore }: {
  history: ActivityItem[] | null; unavailable: boolean; onExplore: () => void;
}) {
  if (unavailable) {
    return <Empty icon="info" title="HISTORY ISN'T AVAILABLE YET." body="Your completed classes will appear here. Please check back later." />;
  }
  if (!history) return <Loading />;
  if (!history.length) {
    return (
      <Empty icon="check" title="YOUR FIRST SESSION AWAITS." body="Completed classes will appear here."
        action="Explore sessions" onAction={onExplore} />
    );
  }
  return (
    <>
      {history.map((item) => {
        const p = programmeFor(item.title);
        return (
          <ProgressRow key={item.id} icon="check" done tag={p.pillar || undefined} title={p.name}
            body={classWhen(item.at)} right="COMPLETED" />
        );
      })}
    </>
  );
}
