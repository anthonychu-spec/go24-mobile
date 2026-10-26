import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { appConfigApi, type AppConfig } from '../api/appConfig';
import { brand, type Feature } from '../brand';

const CACHE_KEY = `app_config:${brand.id}`;

const DEFAULT_CONFIG: AppConfig = {
  brand: brand.id,
  name: brand.name,
  minAppVersion: null,
  maintenanceMessage: null,
  features: brand.features,
};

interface AppConfigState {
  config: AppConfig;
  source: 'default' | 'cache' | 'server';
  minAppVersion: string | null;
  /** Only from a live answer — a cached message would lock out an offline phone. */
  maintenanceMessage: string | null;
  updateRequired: boolean;
  refresh: () => Promise<void>;
}
const AppConfigContext = createContext<AppConfigState | null>(null);

/** Numeric semver compare ('1.10.0' > '1.9.2'); pre-release tags are ignored. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

// Features the server doesn't know yet keep the brand default
function withDefaults(c: AppConfig): AppConfig {
  return { ...c, features: { ...brand.features, ...c.features } };
}

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [source, setSource] = useState<AppConfigState['source']>('default');
  const live = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const data = withDefaults(await appConfigApi.get());
      live.current = true;
      setConfig(data);
      setSource('server');
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)).catch(() => {});
    } catch {
      // No server / offline — keep the cached or default config
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY)
      .then((raw) => {
        if (!raw || live.current) return;
        const cached = JSON.parse(raw) as AppConfig;
        if (cached.brand !== brand.id || !cached.features) return;
        setConfig(withDefaults(cached));
        setSource('cache');
      })
      .catch(() => {});
    void refresh();

    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void refresh(); });
    return () => sub.remove();
  }, [refresh]);

  const appVersion = Constants.expoConfig?.version;
  const minAppVersion = config.minAppVersion;
  const value: AppConfigState = {
    config,
    source,
    minAppVersion,
    maintenanceMessage: source === 'server' ? config.maintenanceMessage : null,
    updateRequired: !!minAppVersion && !!appVersion && compareVersions(appVersion, minAppVersion) < 0,
    refresh,
  };

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig() {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error('useAppConfig must be inside AppConfigProvider');
  return ctx;
}

export function useFeature(f: Feature): boolean {
  return useAppConfig().config.features[f] ?? false;
}
