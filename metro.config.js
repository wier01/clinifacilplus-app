const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

// Force nativewind cache inside the project so Metro can read it in CI.
process.env.CSS_INTEROP_CACHE_DIR = path.join(__dirname, ".cache", "nativewind");

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.join(__dirname, ".cache")];

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
