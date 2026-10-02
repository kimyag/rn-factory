// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Dev web bundles follow expo-sqlite's web worker to its .wasm file. The worker
// never runs: on the web, @factory/core/storage uses the browser's localStorage.
config.resolver.assetExts.push('wasm');

module.exports = config;
