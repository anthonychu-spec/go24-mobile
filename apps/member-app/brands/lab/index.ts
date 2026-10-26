// Per-weight entry points: the package index would bundle every weight
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue/400Regular';
import { Montserrat_500Medium } from '@expo-google-fonts/montserrat/500Medium';
import { Montserrat_600SemiBold } from '@expo-google-fonts/montserrat/600SemiBold';
import { Montserrat_700Bold } from '@expo-google-fonts/montserrat/700Bold';
import type { BrandModule } from '../types';
import { brand } from './brand';

const mod: BrandModule = {
  brand,
  fonts: { BebasNeue_400Regular, Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold },
  logo: require('./assets/logo.png'),
};
export default mod;
