import axios from 'axios';
import { tokenStorage } from '../auth/storage';

export const API_BASE = 'https://api-staging.go24fitness.com/v1';
export const apiClient = axios.create({ baseURL: API_BASE, timeout: 15000 });

apiClient.interceptors.request.use(async (config) => {
  const token = await tokenStorage.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string> | null = null;

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) throw error;
    original._retry = true;
    try {
      if (!refreshing) {
        refreshing = (async () => {
          const refresh = await tokenStorage.getRefresh();
          if (!refresh) throw new Error('no_refresh');
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken: refresh });
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
