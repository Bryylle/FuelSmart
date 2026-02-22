/* eslint-env node */
// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config")

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

const { transformer, resolver } = config

// Combined SVG transformer with your existing inlineRequires setting
config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer"),
  getTransformOptions: async () => ({
    transform: {
      inlineRequires: true,
    },
  }),
}

// Combined SVG resolver with your existing axios and cjs fixes
config.resolver = {
  ...resolver,
  // This allows metro to treat SVGs as source files instead of static assets
  assetExts: resolver.assetExts.filter((ext) => ext !== "svg"),
  sourceExts: [...resolver.sourceExts, "svg", "cjs"],
  
  // Your existing fix for axios/apisauce
  unstable_conditionNames: ["require", "default", "browser"],
}

module.exports = config