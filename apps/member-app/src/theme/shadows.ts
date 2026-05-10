/**
 * Shadow presets — consistent elevation across the app.
 * Use sparingly: only cards, modals, FABs, and bottom bars.
 */
export const shadows = {
  none: {},

  /** Hairline border substitute — no actual shadow */
  hairline: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },

  /** Standard card shadow */
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },

  /** Elevated modal / bottom sheet */
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 12,
  },

  /** Floating action button / primary CTA */
  cta: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  }),
} as const;
