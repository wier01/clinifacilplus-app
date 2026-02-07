const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

// Force nativewind/css-interop cache inside the project so Metro can read it in CI.
const interopCacheDir = path.join(__dirname, "node_modules", "react-native-css-interop", ".cache");
const projectCacheDir = path.join(__dirname, ".cache", "nativewind");

process.env.CSS_INTEROP_CACHE_DIR = interopCacheDir;
fs.mkdirSync(interopCacheDir, { recursive: true });
fs.mkdirSync(projectCacheDir, { recursive: true });

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.join(__dirname, ".cache"), interopCacheDir];

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
