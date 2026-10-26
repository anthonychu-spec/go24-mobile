import { brand } from '../brand';

/** Colour tokens of this build's brand (brands/<brand>/brand.ts). Screens use these, never raw hex. */
export const colors = brand.colors;

/** Gradient stops: `hero` (sign-in background), `cta` (primary button). */
export const gradients = brand.gradients;

/** StatusBar content over colors.bg */
export const statusBarStyle = brand.appearance === 'dark' ? 'light-content' : 'dark-content';
