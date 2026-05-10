/**
 * 4pt base grid — all spacing values are multiples of 4.
 * Use these tokens everywhere instead of raw numbers.
 */
export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  base:16,
  lg:  20,
  xl:  24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

/** Horizontal screen padding — standard content inset */
export const screenPadding = spacing.base;
