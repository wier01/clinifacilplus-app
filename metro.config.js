const expoMetroConfig = require("expo/metro-config");
const nativewindMetro = require("nativewind/metro");

const config = expoMetroConfig.getDefaultConfig(__dirname);

module.exports = nativewindMetro.withNativeWind(config, {
  input: "./global.css",
});
