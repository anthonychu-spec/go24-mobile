import { apiClient } from './client';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string | null; role: string; memberCode: string | null };
}

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<LoginResponse>('/auth/login', { email, password }).then((r) => r.data),
  me: () => apiClient.get<LoginResponse['user']>('/auth/me').then((r) => r.data),
  logout: (refreshToken: string) => apiClient.post('/auth/logout', { refreshToken }).catch(() => {}),
};
