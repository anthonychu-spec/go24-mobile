import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi, type LoginResponse } from '../api/auth';
import { tokenStorage } from './storage';

type User = LoginResponse['user'];
interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await tokenStorage.getAccess();
        if (token) setUser(await authApi.me());
      } catch {
        await tokenStorage.clear();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    await tokenStorage.setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    const refresh = await tokenStorage.getRefresh();
    if (refresh) await authApi.logout(refresh);
    await tokenStorage.clear();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
