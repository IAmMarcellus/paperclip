/**
 * GlassCard — the standard Aurora surface: GlassSurface + card padding + radius.
 * Mirrors the web `Card` (glass fill, white/10 border, elevation shadow).
 */
import { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { radii, shadows, spacing } from "@/theme";
import { GlassSurface } from "./GlassSurface";

export interface GlassCardProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Inner padding. Default spacing.4 (16). */
  padding?: number;
  radius?: number;
  accent?: boolean;
  /** Apply the elevation drop shadow. Default true. */
  elevated?: boolean;
}

export function GlassCard({
  children,
  style,
  padding = spacing[4],
  radius = radii["2xl"],
  accent = false,
  elevated = true,
}: GlassCardProps) {
  return (
    <View style={[elevated && shadows.card, { borderRadius: radius }, style]}>
      <GlassSurface radius={radius} accent={accent}>
        <View style={[styles.inner, { padding }]}>{children}</View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  inner: { position: "relative" },
});
