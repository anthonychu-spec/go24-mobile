import { DetailRow, Message, Note, Sheet } from '../../../ui/kit';
import type { MemberSummary } from './summary';

/** Read-only contact details; changes go through the club (PGM holds the record) */
export function PersonalSheet({ visible, onClose, summary, error }: {
  visible: boolean; onClose: () => void; summary: MemberSummary | null; error: string | null;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} eyebrow="YOUR DETAILS" title="PERSONAL DETAILS.">
      {error && !summary ? <Message text={error} /> : null}
      <DetailRow label="Name" value={summary?.name ?? '—'} />
      <DetailRow label="Email" value={summary?.email ?? '—'} />
      <DetailRow label="Phone" value={summary?.phone ?? '—'} />
      <DetailRow label="Member number" value={summary?.memberCode ?? '—'} />
      <Note>To change your details, please ask the club team.</Note>
    </Sheet>
  );
}
