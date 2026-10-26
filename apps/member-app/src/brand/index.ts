// The brand this build was bundled for (`@brand` -> brands/<APP_BRAND>/, see metro.config.js).
import active from '@brand';

export { FEATURES } from '../../brands/types';
export type { BrandConfig, BrandId, Feature, FeatureFlags } from '../../brands/types';

export const brand = active.brand;
/** For expo-font useFonts(); names match brand.fonts */
export const brandFonts = active.fonts;
/** Wordmark image for dark backgrounds, or null (render brand.wordmark) */
export const brandLogo = active.logo;
