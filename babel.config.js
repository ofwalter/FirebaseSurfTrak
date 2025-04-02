module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // NOTE: Adding Reanimated plugin is necessary if using react-native-reanimated.
      // If you are *sure* you fully removed Reanimated and Gesture Handler
      // (including from package.json and node_modules) you might try commenting
      // this line out. But often, build errors require it to be present if
      // Reanimated was ever installed.
      'react-native-reanimated/plugin',
    ],
  };
}; 