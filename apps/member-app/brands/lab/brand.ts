import { allFeatures, type BrandConfig } from '../types';

// Tokens from apps/lab-prototype-web/site/app.css (Codex v1 Red).
export const brand: BrandConfig = {
  id: 'lab',
  name: 'THE LAB',
  slug: 'the-lab-member',
  scheme: 'thelab',
  appId: 'com.onyx.thelab', // placeholder until decision G4
  apiBase: null,
  easProjectId: null,
  appearance: 'dark',
  layout: 'member',
  shape: { card: 0, button: 0 },
  club: {
    name: 'THE LAB BY ONYX · CENTRAL',
    area: 'CENTRAL, HONG KONG',
    address: ['Basement, Haleson Building', '1 Jubilee Street, Central, Hong Kong'],
    hours: ['Mon–Fri 06:30–21:30', 'Sat, Sun & public holidays 08:00–18:00'],
  },
  splashBackground: '#131313',
  colors: {
    bg: '#131313',          // --bg
    card: '#1D1D1D',        // --panel
    cardSoft: '#242323',
    border: '#FFFFFF18',    // --line
    primary: '#810917',     // --red
    primaryMid: '#6B0713',
    primaryDark: '#4A040D',
    primaryBg: '#2A1114',
    onPrimary: '#FFFFFF',
    link: '#DA8792',        // --bright (red is too dark for text on --panel)
    cta: '#DA8792',         // --bright
    ctaBg: '#2A1619',
    text: '#FFFFF0',        // --white
    textSecond: '#EBEBEB',  // --silver
    textMuted: '#AAA9A8',   // --muted
    blue: '#8FB0E0',
    blueBg: '#18202B',
    indigo: '#A9A6EC',
    indigoBg: '#1E1D2E',
    teal: '#7CC3D1',
    tealBg: '#142426',
    green: '#8CCB9C',
    greenBg: '#16241A',
    amber: '#E3B66C',
    amberBg: '#2A2216',
    rose: '#DA8792',
    roseBg: '#2A1619',
    error: '#F08A96',
    success: '#8CCB9C',
    warning: '#E3B66C',
  },
  gradients: {
    hero: ['#0B0B0B', '#171717', '#1E0A0D', '#810917'],
    cta: ['#810917', '#5E0611'],
  },
  // The prototype maps Montserrat 400–500 to the Medium cut and 700–900 to Bold
  fonts: {
    regular: 'Montserrat_500Medium',
    semibold: 'Montserrat_600SemiBold',
    bold: 'Montserrat_700Bold',
    black: 'Montserrat_700Bold',
    display: 'BebasNeue_400Regular',
  },
  wordmark: { title: 'THE LAB', sub: 'BY ONYX' },
  copy: { heroTitle: 'WELCOME TO\nTHE LAB.', heroSub: 'Sign in to see your visits, bookings and personal milestones.' },
  assets: {
    icon: './brands/lab/assets/icon.png',
    adaptiveIcon: './brands/lab/assets/adaptive-icon.png',
    splash: './brands/lab/assets/splash-icon.png',
    favicon: './brands/lab/assets/favicon.png',
  },
  // Same as the backend's brand_features for lab (core v1: classes only)
  features: { ...allFeatures(false), classes: true },
};
