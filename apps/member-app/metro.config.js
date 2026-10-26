// Expo's defaults already handle the pnpm monorepo (watch folders, node_modules lookup).
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `@brand` -> brands/<APP_BRAND>/index.ts, so a build only bundles its own brand.
// Same variable and default as app.config.ts.
const BRANDS = ['lab', 'foundry', 'go24'];
const brandId = process.env.APP_BRAND || 'go24';
if (!BRANDS.includes(brandId)) throw new Error(`APP_BRAND must be one of ${BRANDS.join(', ')} (got "${brandId}")`);
const brandEntry = path.join(__dirname, 'brands', brandId, 'index.ts');

const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@brand') return { type: 'sourceFile', filePath: brandEntry };
  return (upstream ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
