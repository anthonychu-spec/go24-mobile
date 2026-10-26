// `@brand` is resolved by metro.config.js to brands/<APP_BRAND>/index.ts.
declare module '@brand' {
  import type { BrandModule } from './types';
  const mod: BrandModule;
  export default mod;
}
