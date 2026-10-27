// `@brand` is resolved by metro.config.js to brands/<APP_BRAND>/index.ts.
// Typed as BrandModule in src/brand/index.ts (ambient modules can't import relative paths).
declare module '@brand' {
  const mod: unknown;
  export default mod;
}
