import { getLocales } from 'expo-localization';
import { en } from './locales/en';
import { zhHK } from './locales/zh-HK';

const locales: Record<string, typeof en> = { en, 'zh-HK': zhHK };
const tag = getLocales()[0]?.languageTag ?? 'en';
export const t = locales[tag] ?? locales[tag.split('-')[0]] ?? en;
