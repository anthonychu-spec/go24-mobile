import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY  = 'go24_access';
const REFRESH_KEY = 'go24_refresh';

// Web: use localStorage; Native: use SecureStore
const store = Platform.OS === 'web'
  ? {
      getItemAsync:    (key: string) => Promise.resolve(localStorage.getItem(key)),
      setItemAsync:    (key: string, value: string) => { localStorage.setItem(key, value); return Promise.resolve(); },
      deleteItemAsync: (key: string) => { localStorage.removeItem(key); return Promise.resolve(); },
    }
  : SecureStore;

export const tokenStorage = {
  getAccess:  () => store.getItemAsync(ACCESS_KEY),
  getRefresh: () => store.getItemAsync(REFRESH_KEY),
  setTokens:  (a: string, r: string) =>
    Promise.all([store.setItemAsync(ACCESS_KEY, a), store.setItemAsync(REFRESH_KEY, r)]),
  clear: () =>
    Promise.all([store.deleteItemAsync(ACCESS_KEY), store.deleteItemAsync(REFRESH_KEY)]),
};
