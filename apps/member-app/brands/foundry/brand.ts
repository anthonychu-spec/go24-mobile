import { allFeatures, type BrandConfig } from '../types';

// Tokens from apps/foundry-demo/src/theme/tokens.ts. Foundry screens are phase 5.
export const brand: BrandConfig = {
  id: 'foundry',
  name: 'The Foundry',
  slug: 'the-foundry-member',
  scheme: 'thefoundry',
  appId: 'com.thefoundry.member', // placeholder until the store listing is decided
  apiBase: null,
  easProjectId: null,
  appearance: 'light',
  splashBackground: '#EDE9E1',
  colors: {
    bg: '#EDE9E1',          // page
    card: '#F7F6F2',        // cream
    cardSoft: '#EFECE5',    // soft
    border: '#E4E0D4',      // beige
    primary: '#102940',     // navy
    primaryMid: '#045668',  // teal
    primaryDark: '#0A1B2B',
    primaryBg: '#E3EAF0',
    onPrimary: '#F7F6F2',
    link: '#CE5531',
    cta: '#CE5531',         // orange
    ctaBg: '#F6E3DC',
    text: '#102940',
    textSecond: '#3B4F63',
    textMuted: '#586979',
    blue: '#5889BD',
    blueBg: '#E6EEF6',
    indigo: '#102940',
    indigoBg: '#E3EAF0',
    teal: '#045668',
    tealBg: '#E0EEF0',
    green: '#2E7D4F',
    greenBg: '#E7F2EA',
    amber: '#C5A75F',
    amberBg: '#F5EFDD',
    rose: '#CE5531',
    roseBg: '#F6E3DC',
    error: '#B3261E',
    success: '#2E7D4F',
    warning: '#C5A75F',
  },
  gradients: {
    hero: ['#0A1B2B', '#102940', '#045668'],
    cta: ['#CE5531', '#A9401F'],
  },
  // TODO(decision #5): display font becomes IvyJournal once licensed; Outfit until then
  fonts: {
    regular: 'Outfit_400Regular',
    semibold: 'Outfit_600SemiBold',
    bold: 'Outfit_700Bold',
    black: 'Outfit_700Bold',
    display: 'Outfit_400Regular',
  },
  wordmark: { title: 'THE FOUNDRY', sub: '' },
  copy: { heroTitle: 'Welcome to\nThe Foundry', heroSub: 'Sign in to book and manage your visits.' },
  assets: {
    icon: './brands/foundry/assets/icon.png',
    adaptiveIcon: './brands/foundry/assets/adaptive-icon.png',
    adaptiveIconBackground: './brands/foundry/assets/adaptive-icon-background.png',
    adaptiveIconMonochrome: './brands/foundry/assets/adaptive-icon-monochrome.png',
    splash: './brands/foundry/assets/splash-icon.png',
    favicon: './brands/foundry/assets/favicon.png',
  },
  // Set with the Foundry scope (phase 5)
  features: { ...allFeatures(false), classes: true },
};
