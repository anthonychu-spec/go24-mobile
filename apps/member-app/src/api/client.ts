import axios from 'axios';
import { tokenStorage } from '../auth/storage';
import { brand } from '../brand';
import { isFeatureOff } from './errors';
import { MOCK_API, mockAdapter } from './mock';

const LOCAL_API = 'http://localhost:3000/v1';

function resolveApiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  const base = fromEnv || brand.apiBase;
  if (base) return base.replace(/\/+$/, '');
  if (!MOCK_API) console.warn(`[api] no EXPO_PUBLIC_API_URL or brand.apiBase for "${brand.id}"; using ${LOCAL_API}`);
  return LOCAL_API;
}

/** API root incl. `/v1`, no trailing slash. */
export const API_BASE = resolveApiBase();

/** Sent on every request; the backend picks the brand from it until the token carries one. */
export const BRAND_HEADERS = { 'X-App-Brand': brand.id } as const;

/** EXPO_PUBLIC_API_MOCK=1 answers every request in-app (src/api/mock) */
export const API_ADAPTER = MOCK_API ? mockAdapter : undefined;

export const apiClient = axios.create({ baseURL: API_BASE, timeout: 30000, headers: BRAND_HEADERS, adapter: API_ADAPTER });

apiClient.interceptors.request.use(async (config) => {
  const token = await tokenStorage.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const featureOffListeners = new Set<() => void>();

/** Called when a route answers with the feature guard's 404 (the brand has that feature off) */
export function onFeatureOff(listener: () => void): () => void {
  featureOffListeners.add(listener);
  return () => { featureOffListeners.delete(listener); };
}

let refreshing: Promise<string> | null = null;

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (isFeatureOff(error)) featureOffListeners.forEach((l) => l());
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) throw error;
    original._retry = true;
    try {
      if (!refreshing) {
        refreshing = (async () => {
          const refresh = await tokenStorage.getRefresh();
          if (!refresh) throw new Error('no_refresh');
          const { data } = await axios.post(
            `${API_BASE}/auth/refresh`,
            { refreshToken: refresh },
            { headers: BRAND_HEADERS, timeout: 30000, adapter: API_ADAPTER },
          );
          await tokenStorage.setTokens(data.accessToken, data.refreshToken);
          return data.accessToken;
        })().finally(() => { refreshing = null; });
      }
      const newToken = await refreshing;
      original.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(original);
    } catch {
      await tokenStorage.clear();
      throw error;
    }
  },
);
