const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const cacheDir = path.join(projectRoot, ".cache", "nativewind");

process.env.RN_CSS_INTEROP_CACHE_DIR = cacheDir;

const config = getDefaultConfig(projectRoot);
config.watchFolders = [cacheDir];

module.exports = withNativeWind(config, { input: "./global.css" });
