const { withInfoPlist } = require('@expo/config-plugins');

/**
 * react-native-vision-camera v5 ships only ESM in lib/ and has no app.plugin.js,
 * so Expo's config-plugin resolver crashes trying to require() it. We apply the
 * camera permission string directly here instead.
 */
function withVisionCameraPermission(config) {
  return withInfoPlist(config, (mod) => {
    mod.modResults.NSCameraUsageDescription =
      `${config.name} needs camera access to record your training sessions.`;
    return mod;
  });
}

/** @type {import('@expo/config').ExpoConfig} */
const config = {
  extra: {
    eas: {
      projectId: "73fd018c-bf98-4632-9502-47370df94942",
    },
  },
  name: "Bike Training",
  slug: "bike-training-app",
  description: "A mobile-first motorcycle drill tracker for cone setups, session timing, and practice progress.",
  version: "1.0.0",
  scheme: "biketraining",
  platforms: ["ios", "android", "web"],
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  backgroundColor: "#101214",
  primaryColor: "#F2A23A",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.biketraining.app",
  },
  android: {
    package: "com.biketraining.app",
    adaptiveIcon: {
      backgroundColor: "#101214",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/favicon.png",
    name: "Bike Training",
    shortName: "Bike Drills",
    lang: "en",
    scope: "/",
    themeColor: "#101214",
    backgroundColor: "#101214",
    display: "standalone",
    startUrl: ".",
    orientation: "portrait",
    description: "Plan cone drills, time sessions, and track riding progress from phone or browser.",
  },
  plugins: [
    withVisionCameraPermission,
    "expo-video",
    [
      "expo-build-properties",
      {
        ios: {
          deploymentTarget: "16.4",
        },
      },
    ],
    [
      "expo-media-library",
      {
        photosPermission: "Allow $(PRODUCT_NAME) to save training videos to your camera roll.",
        savePhotosPermission: "Allow $(PRODUCT_NAME) to save training videos to your camera roll.",
        isAccessMediaLocationEnabled: false,
      },
    ],
  ],
};

module.exports = config;
