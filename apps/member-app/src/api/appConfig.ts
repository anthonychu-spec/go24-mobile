import type { FeatureFlags } from '../brand';
import { publicClient } from './public';

/** GET /v1/app-config (brand from X-App-Brand). */
export interface AppConfig {
  brand: string;
  name: string;
  minAppVersion: string | null;
  maintenanceMessage: string | null;
  features: FeatureFlags;
}

export const appConfigApi = {
  get: () => publicClient.get<AppConfig>('/app-config', { timeout: 10_000 }).then((r) => r.data),
};
