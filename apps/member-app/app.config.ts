import 'tsx/cjs'; // lets this file import the TypeScript brand configs
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { BRAND_IDS, isBrandId, type BrandConfig, type BrandId } from './brands/types';
import { brand as foundry } from './brands/foundry/brand';
import { brand as go24 } from './brands/go24/brand';
import { brand as lab } from './brands/lab/brand';

// One codebase, one build per brand: APP_BRAND=lab|foundry|go24 (default go24).
// metro.config.js reads the same variable to bundle brands/<APP_BRAND>/.
const BRANDS: Record<BrandId, BrandConfig> = { lab, foundry, go24 };

const brandId = process.env.APP_BRAND || 'go24';
if (!isBrandId(brandId)) {
  throw new Error(`APP_BRAND must be one of ${BRAND_IDS.join(', ')} (got "${brandId}")`);
}
const brand = BRANDS[brandId];
const { assets } = brand;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: brand.name,
  slug: brand.slug,
  version: '1.0.0',
  scheme: brand.scheme,
  orientation: 'portrait',
  icon: assets.icon,
  userInterfaceStyle: brand.appearance,
  ios: {
    supportsTablet: false,
    bundleIdentifier: brand.appId,
  },
  android: {
    package: brand.appId,
    adaptiveIcon: {
      foregroundImage: assets.adaptiveIcon,
      backgroundImage: assets.adaptiveIconBackground,
      monochromeImage: assets.adaptiveIconMonochrome,
      backgroundColor: brand.splashBackground,
    },
  },
  web: {
    bundler: 'metro',
    favicon: assets.favicon,
  },
  // A new native fingerprint means a new build; OTA updates only reach matching builds
  runtimeVersion: { policy: 'fingerprint' },
  // Each brand gets its own Expo project (gate G1); until then no update URL
  ...(brand.easProjectId && { updates: { url: `https://u.expo.dev/${brand.easProjectId}` } }),
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    'expo-localization',
    'expo-sharing',
    'expo-status-bar',
    ['expo-splash-screen', { image: assets.splash, imageWidth: 200, resizeMode: 'contain', backgroundColor: brand.splashBackground }],
    // Kept for every brand so the native build stays the same; LAB v1 hides payments
    '@adyen/react-native',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    brand: brand.id,
    ...(brand.easProjectId && { eas: { projectId: brand.easProjectId } }),
  },
});
