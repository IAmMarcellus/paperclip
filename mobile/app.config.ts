import type { ExpoConfig } from "expo/config";

/**
 * Paperclip "Aurora" mobile app.
 *
 * iOS-first: NativeTabs + expo-glass-effect render real Liquid Glass on iOS 26.
 * Android (and iOS < 26) fall back to expo-blur glass — same code, see
 * components/ui/GlassSurface.tsx.
 */

// iOS App Transport Security blocks plaintext http:// to non-localhost hosts. When the backend is
// reached over an http:// Tailscale MagicDNS name (tailnet traffic is already WireGuard-encrypted),
// set EXPO_PUBLIC_ATS_INSECURE_DOMAIN to that domain (e.g. "taild2b25b.ts.net") in a gitignored
// .env.local to add a scoped exception. Empty => no exception baked in (clean vanilla build).
const atsInsecureDomain = process.env.EXPO_PUBLIC_ATS_INSECURE_DOMAIN?.trim();

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
    ...(atsInsecureDomain
      ? {
          infoPlist: {
            NSAppTransportSecurity: {
              NSExceptionDomains: {
                [atsInsecureDomain]: {
                  NSIncludesSubdomains: true,
                  NSExceptionAllowsInsecureHTTPLoads: true,
                },
              },
            },
          },
        }
      : {}),
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
