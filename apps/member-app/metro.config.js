const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Standalone mode — only watch this app's directory, not the pnpm workspace root
config.watchFolders = [__dirname];

module.exports = config;
