// Shape every brand in brands/<id>/ must satisfy.
// brand.ts is plain data (read by app.config.ts in Node and by the app);
// index.ts adds what only the bundle can load (fonts, logo).

export const BRAND_IDS = ['lab', 'foundry', 'go24'] as const;
export type BrandId = (typeof BRAND_IDS)[number];

export function isBrandId(v: unknown): v is BrandId {
  return typeof v === 'string' && (BRAND_IDS as readonly string[]).includes(v);
}

/** Same list as backend/nest-api/src/brand/brand.constants.ts FEATURES. */
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
export type FeatureFlags = Record<Feature, boolean>;

export interface BrandColors {
  bg: string;
  card: string;
  cardSoft: string;
  border: string;
  primary: string;
  primaryMid: string;
  primaryDark: string;
  primaryBg: string;
  /** Text / icons on primary and on the hero gradient */
  onPrimary: string;
  /** Text links on card backgrounds */
  link: string;
  cta: string;
  ctaBg: string;
  text: string;
  textSecond: string;
  textMuted: string;
  blue: string;
  blueBg: string;
  indigo: string;
  indigoBg: string;
  teal: string;
  tealBg: string;
  green: string;
  greenBg: string;
  amber: string;
  amberBg: string;
  rose: string;
  roseBg: string;
  error: string;
  success: string;
  warning: string;
}

/** Font family names as registered with expo-font (keys of index.ts `fonts`). */
export interface BrandFonts {
  regular: string;
  semibold: string;
  bold: string;
  black: string;
  /** Headlines, wordmarks, big numbers */
  display: string;
}

export interface BrandConfig {
  id: BrandId;
  /** Store / home-screen name */
  name: string;
  slug: string;
  scheme: string;
  /** iOS bundle id and Android package (one value for both) */
  appId: string;
  /** API root incl. `/v1`; null until the server exists (gate G5). EXPO_PUBLIC_API_URL wins. */
  apiBase: string | null;
  /** Expo project id (push + EAS Update); null until the group Expo account exists (gate G1). */
  easProjectId: string | null;
  appearance: 'light' | 'dark';
  /** Splash screen and Android adaptive-icon background */
  splashBackground: string;
  colors: BrandColors;
  gradients: {
    /** Sign-in background, top → bottom */
    hero: [string, string, ...string[]];
    cta: [string, string, ...string[]];
  };
  fonts: BrandFonts;
  /** Text wordmark, used when the brand has no logo image */
  wordmark: { title: string; sub: string };
  copy: { heroTitle: string; heroSub: string };
  /** Paths relative to apps/member-app, for app.config.ts */
  assets: {
    icon: string;
    adaptiveIcon: string;
    adaptiveIconBackground?: string;
    adaptiveIconMonochrome?: string;
    splash: string;
    favicon: string;
  };
  /** Offline defaults; GET /v1/app-config overrides them. */
  features: FeatureFlags;
}

export interface BrandModule {
  brand: BrandConfig;
  /** Passed to expo-font useFonts(); keys are the names in brand.fonts */
  fonts: Record<string, number>;
  /** Wordmark image for dark backgrounds, or null to render brand.wordmark */
  logo: number | null;
}

export const allFeatures = (on: boolean): FeatureFlags =>
  Object.fromEntries(FEATURES.map((f) => [f, on])) as FeatureFlags;
