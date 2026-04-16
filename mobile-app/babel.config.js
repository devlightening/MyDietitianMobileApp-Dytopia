/**
 * Babel configuration for Expo SDK 54 + React Native Reanimated 4.x
 *
 * ▸ babel-preset-expo — required for Expo projects; handles JSX, TS,
 *   platform-specific transforms, and Hermes/New Architecture compatibility.
 *   Version must match the installed expo package (see devDependencies).
 *
 * ▸ react-native-reanimated/plugin — still required in Reanimated 4.x.
 *   In v4 this is a thin re-export of react-native-worklets/plugin which
 *   transforms 'worklet' functions and useAnimatedStyle callbacks so they
 *   can execute on the UI thread via JSI.
 *   MUST be listed last among plugins (Reanimated requirement).
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin', // must be last
    ],
  };
};
