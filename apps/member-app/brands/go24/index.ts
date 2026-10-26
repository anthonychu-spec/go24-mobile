// Per-weight entry points: the package index would bundle every weight
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_900Black } from '@expo-google-fonts/inter/900Black';
import type { BrandModule } from '../types';
import { brand } from './brand';

const mod: BrandModule = {
  brand,
  fonts: { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_900Black },
  logo: null,
};
export default mod;
