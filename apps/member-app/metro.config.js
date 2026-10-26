// Expo's defaults already handle the pnpm monorepo (watch folders, node_modules lookup).
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
