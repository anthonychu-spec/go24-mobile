// TEMP STUB — replaced by the brand layer (brands/<brand>/brand.ts via the `@brand` alias).
// Keep this export shape: `brand.id`, `brand.name`, `brand.apiBase`, `brand.easProjectId`, `brand.features`.

export type BrandId = 'lab' | 'foundry' | 'go24';

/** Same list as backend/nest-api/src/brand/brand.constants.ts FEATURES. */
export const FEATURES = [
  'classes',
  'member_qr',
  'payments',
  'signup',
  'pt',
  'referral',
  'favourites',
  'freeze',
  'recovery_native',
  'recovery_portal',
  'coaching_enquiry',
] as const;
export type Feature = (typeof FEATURES)[number];
export type FeatureFlags = Record<Feature, boolean>;

export interface BrandRuntime {
  id: BrandId;
  name: string;
  /** API root incl. `/v1`; null until the server exists (gate G5). EXPO_PUBLIC_API_URL wins. */
  apiBase: string | null;
  /** Expo project id (push + EAS Update); null until the group Expo account exists (gate G1). */
  easProjectId: string | null;
  /** Offline defaults; GET /v1/app-config overrides them. */
  features: FeatureFlags;
}

export const brand: BrandRuntime = {
  id: 'go24',
  name: 'GO24',
  apiBase: null,
  easProjectId: null,
  features: Object.fromEntries(FEATURES.map((f) => [f, true])) as FeatureFlags,
};
