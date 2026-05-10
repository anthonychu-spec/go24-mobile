/**
 * Border radius scale — consistent rounding across the app.
 * Premium fitness apps use generous radii for a modern soft feel.
 */
export const radius = {
  xs:   4,   // inline badges, small tags
  sm:   8,   // small buttons, compact chips
  md:   12,  // inputs, small cards
  lg:   16,  // standard cards
  xl:   20,  // large cards, modals
  '2xl':24,  // hero cards, bottom sheets
  '3xl':28,  // premium hero sections
  full: 9999, // circles, pills
} as const;
