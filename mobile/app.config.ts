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
// set EXPO_PUBLIC_ATS_INSECURE_DOMAIN to that domain (e.g. "<REDACTED_TAILNET>.ts.net") in a gitignored
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
    infoPlist: {
      // Voice: the Pipecat SmallWebRTC stack requests the mic when a Mergatroid call starts.
      NSMicrophoneUsageDescription:
        "Paperclip uses the microphone so you can talk to Mergatroid, the voice assistant.",
      // Keep the realtime audio session alive if the call is backgrounded (screen lock mid-call).
      // "voip" matches the Pipecat RN example; "audio" covers plain playback.
      UIBackgroundModes: ["audio", "voip"],
      // Reaching the backend over an http:// Tailscale host needs a scoped ATS exception (see above).
      ...(atsInsecureDomain
        ? {
            NSAppTransportSecurity: {
              NSExceptionDomains: {
                [atsInsecureDomain]: {
                  NSIncludesSubdomains: true,
                  NSExceptionAllowsInsecureHTTPLoads: true,
                },
              },
            },
          }
        : {}),
    },
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
    // Native WebRTC for the self-hosted Pipecat voice path (@pipecat-ai/react-native-small-webrtc-
    // transport → Daily's react-native-webrtc fork + daily-js media manager). The Daily config plugin
    // wires the WebRTC pods, permissions, and audio session. NOTE: all react-native-webrtc forks
    // register the same native WebRTCModule, so this is mutually exclusive with the LiveKit/ElevenLabs
    // stack — the app speaks pipecat only (web keeps the ElevenLabs fallback).
    "@daily-co/config-plugin-rn-daily-js",
  ],
  experiments: {
    // Typed routes are great but reject dynamic template hrefs; keep off for v1.
    typedRoutes: false,
  },
};

export default config;
