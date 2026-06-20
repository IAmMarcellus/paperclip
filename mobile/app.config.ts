import type { ExpoConfig } from "expo/config";

/**
 * Paperclip "Aurora" mobile app.
 *
 * iOS-first: NativeTabs + expo-glass-effect render real Liquid Glass on iOS 26.
 * Android (and iOS < 26) fall back to expo-blur glass — same code, see
 * components/ui/GlassSurface.tsx.
 */
const config: ExpoConfig = {
  name: "Paperclip",
  slug: "paperclip-mobile",
  version: "0.1.0",
  scheme: "paperclip",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  icon: "./assets/icon.png",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "ai.paperclip.mobile",
  },
  android: {
    package: "ai.paperclip.mobile",
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#08080a",
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-font",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#08080a",
        image: "./assets/splash.png",
        imageWidth: 180,
      },
    ],
  ],
  experiments: {
    // Typed routes are great but reject dynamic template hrefs; keep off for v1.
    typedRoutes: false,
  },
};

export default config;
