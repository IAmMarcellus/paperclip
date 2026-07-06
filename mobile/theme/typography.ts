/**
 * Typography presets mirroring the web (vendor/paperclip/ui/src/index.css):
 *   --font-display : Bricolage Grotesque  (big titles, numbers)
 *   --font-sans    : Space Grotesk        (body, buttons)
 *   --font-mono    : JetBrains Mono        (labels, timestamps — uppercase, spaced)
 *
 * Family names are the keys @expo-google-fonts registers via useFonts()
 * (see theme/fonts.ts).
 */
import { StyleSheet, type TextStyle } from "react-native";

import { colors } from "./tokens";

export const fontFamily = {
  // Space Grotesk
  sans: "SpaceGrotesk_400Regular",
  sansMedium: "SpaceGrotesk_500Medium",
  sansSemibold: "SpaceGrotesk_600SemiBold",
  sansBold: "SpaceGrotesk_700Bold",
  // Bricolage Grotesque
  display: "BricolageGrotesque_400Regular",
  displayBold: "BricolageGrotesque_700Bold",
  // JetBrains Mono
  mono: "JetBrainsMono_400Regular",
  monoMedium: "JetBrainsMono_500Medium",
  monoSemibold: "JetBrainsMono_600SemiBold",
} as const;

/** Text style presets — use as `style={[text.body, ...]}`. */
export const text = StyleSheet.create({
  // Display (Bricolage, tight tracking)
  displayXl: {
    fontFamily: fontFamily.displayBold,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.75,
    color: colors.foreground,
  },
  displayLg: {
    fontFamily: fontFamily.displayBold,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.65,
    color: colors.foreground,
  },
  displayMd: {
    fontFamily: fontFamily.displayBold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.5,
    color: colors.foreground,
  },
  // Body (Space Grotesk)
  title: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.foreground,
  },
  body: {
    fontFamily: fontFamily.sans,
    fontSize: 15,
    lineHeight: 21,
    color: colors.foreground,
  },
  bodyMedium: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 15,
    lineHeight: 21,
    color: colors.foreground,
  },
  small: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
  smallMedium: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.foreground,
  },
  // Mono labels (uppercase, spaced) — section labels, timestamps
  label: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.mutedForeground,
  } as TextStyle,
  mono: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    lineHeight: 16,
    color: colors.mutedForeground,
  },
});
