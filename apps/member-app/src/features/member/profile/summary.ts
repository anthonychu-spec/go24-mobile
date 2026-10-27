import { meApi } from '../../../api/member';
import { hkDateKey, MONTHS } from '../../../lib/hkTime';

/** Profile + dashboard in one shape (member card, pass, personal details) */
export interface MemberSummary {
  name: string | null;
  memberCode: string | null;
  email: string | null;
  phone: string | null;
  hasMembership: boolean | null;
  planName: string | null;
  active: boolean | null;
  expiresAt: string | null;
  /** One of the two calls failed; what's here came from the other */
  incomplete: boolean;
}

const fullName = (first: string | null, last: string | null) => [first, last].filter(Boolean).join(' ') || null;

/** Throws only when both calls fail */
export async function loadMemberSummary(): Promise<MemberSummary> {
  const [p, d] = await Promise.allSettled([meApi.profile(), meApi.dashboard()]);
  if (p.status === 'rejected' && d.status === 'rejected') throw p.reason;
  const profile = p.status === 'fulfilled' ? p.value : null;
  const dash = d.status === 'fulfilled' ? d.value : null;
  const m = profile?.member;
  return {
    name: m?.name?.trim() || fullName(m?.firstName ?? null, m?.lastName ?? null) || dash?.user.name || null,
    memberCode: m?.memberCode ?? dash?.user.memberCode ?? null,
    email: m?.email ?? dash?.user.email ?? null,
    phone: m?.phone ?? null,
    hasMembership: profile ? profile.hasMembership : null,
    planName: dash?.membership.planName ?? null,
    active: dash ? dash.membership.active : null,
    expiresAt: dash?.membership.expiresAt ?? null,
    incomplete: !profile || !dash,
  };
}

/** '28 MAY 2027' (Hong Kong date), or null if unreadable */
export function formatExpiry(at: string | null): string | null {
  if (!at || Number.isNaN(new Date(at).getTime())) return null;
  const [y, m, d] = hkDateKey(at).split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}
