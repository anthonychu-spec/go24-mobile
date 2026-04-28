import * as SecureStore from 'expo-secure-store';
const ACCESS_KEY = 'go24_access';
const REFRESH_KEY = 'go24_refresh';
export const tokenStorage = {
  getAccess: () => SecureStore.getItemAsync(ACCESS_KEY),
  getRefresh: () => SecureStore.getItemAsync(REFRESH_KEY),
  setTokens: (a: string, r: string) =>
    Promise.all([SecureStore.setItemAsync(ACCESS_KEY, a), SecureStore.setItemAsync(REFRESH_KEY, r)]),
  clear: () =>
    Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]),
};
