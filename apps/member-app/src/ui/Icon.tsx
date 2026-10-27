import { SvgXml } from 'react-native-svg';
import { colors } from '../theme';

// Line icons from the LAB prototype (apps/lab-prototype-web/site/app.js), plus close/trash/shield/mail/phone.
const paths = {
  home: '<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7"/>',
  book: '<rect x="4" y="5" width="16" height="16" rx="1"/><path d="M8 2v6M16 2v6M4 11h16M8 15h3M14 15h2"/>',
  passport: '<rect x="5" y="3" width="14" height="18" rx="1"/><circle cx="12" cy="10" r="3"/><path d="M8 17h8M12 7v6M9 10h6"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  qr: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h4v4h-7zM17 14h4M6 6h1M17 6h1M6 17h1"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chev: '<path d="m9 5 7 7-7 7"/>',
  strength: '<path d="M3 8v8M6 5v14M18 5v14M21 8v8M6 12h12"/>',
  recovery: '<path d="M12 3s-7 8-7 12a7 7 0 0 0 14 0c0-4-7-12-7-12Z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
  pt: '<circle cx="12" cy="6" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3M3 11h4M17 11h4"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  trend: '<path d="m3 17 6-6 4 4 8-11M14 4h7v7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
  star: '<path d="m12 3 3 6 6 1-4.5 4.5L18 21l-6-3-6 3 1.5-6.5L3 10l6-1z"/>',
  wallet: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 8h18M16 12h5v5h-5z"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  message: '<path d="M21 3H3v14h4v4l5-4h9zM7 8h10M7 12h7"/>',
  logout: '<path d="M10 3H4v18h6M14 8l5 4-5 4M8 12h12"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 7 9 6 9-6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z"/>',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, color = colors.text, strokeWidth = 1.6 }: {
  name: IconName; size?: number; color?: string; strokeWidth?: number;
}) {
  const xml = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="square" stroke-linejoin="miter">${paths[name]}</svg>`;
  return <SvgXml xml={xml} width={size} height={size} />;
}
