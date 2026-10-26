export const BRAND_IDS = ['lab', 'foundry', 'go24', 'onyx'] as const;
export type BrandId = (typeof BRAND_IDS)[number];

/** Requests without a brand (the existing GO24 app sends no header) keep today's behaviour. */
export const DEFAULT_BRAND: BrandId = 'go24';

export const BRAND_HEADER = 'x-app-brand';

/** Switchable per brand in `brand_features`. A feature with no row counts as off. */
export const FEATURES = [
  'classes',          // class schedule, booking, waitlist
  'member_qr',        // signed QR on the member pass (otherwise member number only)
  'payments',         // saved card, outstanding balance, day pass, payment history
  'signup',           // new-member signup + face enrolment
  'pt',               // PT agreements, sessions, signatures
  'referral',
  'favourites',
  'freeze',           // freeze request
  'recovery_native',  // facility booking through PGM
  'recovery_portal',  // facility booking hand-off to PGM Client Portal
  'coaching_enquiry',
] as const;
export type Feature = (typeof FEATURES)[number];

export function isBrandId(v: unknown): v is BrandId {
  return typeof v === 'string' && (BRAND_IDS as readonly string[]).includes(v);
}
