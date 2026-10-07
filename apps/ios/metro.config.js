const { getDefaultConfig } = require("expo/metro-config");

// Expo finds the pnpm workspace root on its own.
module.exports = getDefaultConfig(__dirname);
