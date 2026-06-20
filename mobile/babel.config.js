// babel-preset-expo bundles the react-native-reanimated plugin automatically
// (SDK 54+), so it must NOT be listed again here or it double-applies.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
