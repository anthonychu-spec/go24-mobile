export const colors = {
  // ── Backgrounds ──────────────────────────────
  bg:       '#F4F4F8',   // warm off-white, less harsh than pure iOS gray
  card:     '#FFFFFF',
  cardSoft: '#F9F9FC',   // subtle card variant
  border:   '#EBEBF0',

  // ── Brand Red — vibrant, modern, not blood red ──
  primary:     '#E8192C',   // vivid red (was #B5001E — too dark/somber)
  primaryMid:  '#C8001F',   // mid red for gradients
  primaryDark: '#9A0018',   // dark end of gradient
  primaryBg:   '#FFF0F1',   // red tint background (alerts, badges)

  // ── CTA ──────────────────────────────────────
  cta:     '#FF6B00',   // orange
  ctaBg:   '#FFF4EC',

  // ── Text ─────────────────────────────────────
  text:       '#18181B',   // near-black, warmer than iOS default
  textSecond: '#52525B',   // medium gray
  textMuted:  '#A1A1AA',   // subtle gray

  // ── Accent palette (curated, not rainbow) ────
  blue:   '#2563EB',   // rich blue
  blueBg: '#EFF6FF',
  indigo:   '#4F46E5',
  indigoBg: '#EEF2FF',
  teal:   '#0891B2',
  tealBg: '#ECFEFF',
  green:  '#16A34A',
  greenBg:'#F0FDF4',
  amber:  '#D97706',
  amberBg:'#FFFBEB',
  rose:   '#E11D48',
  roseBg: '#FFF1F2',

  // ── Status ───────────────────────────────────
  error:   '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
} as const;
