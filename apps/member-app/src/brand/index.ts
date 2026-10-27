// The brand this build was bundled for (`@brand` -> brands/<APP_BRAND>/, see metro.config.js).
import bundled from '@brand';
import type { BrandModule } from '../../brands/types';

const active = bundled as BrandModule;

export { FEATURES } from '../../brands/types';
export type { BrandConfig, BrandId, Feature, FeatureFlags, MemberContent, Programme } from '../../brands/types';

export const brand = active.brand;
/** For expo-font useFonts(); names match brand.fonts */
export const brandFonts = active.fonts;
/** Wordmark image for dark backgrounds, or null (render brand.wordmark) */
export const brandLogo = active.logo;
/** Small mark for headers and the member card, or null */
export const brandMark = active.mark;
/** Editorial content for the member layout; null for classic-layout brands */
export const brandContent = active.content;
