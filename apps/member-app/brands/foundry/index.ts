// Per-weight entry points: the package index would bundle every weight
import { Outfit_400Regular } from '@expo-google-fonts/outfit/400Regular';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';
import { Outfit_700Bold } from '@expo-google-fonts/outfit/700Bold';
import type { BrandModule } from '../types';
import { brand } from './brand';

const mod: BrandModule = {
  brand,
  fonts: { Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold },
  logo: require('./assets/logo.png'),
};
export default mod;
