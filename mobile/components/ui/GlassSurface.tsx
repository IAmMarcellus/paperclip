/**
 * GlassSurface — the one place that branches on glass capability.
 *
 *   iOS 26 (isLiquidGlassAvailable) → native <GlassView>  (real Liquid Glass)
 *   iOS < 26 / Android              → <BlurView>           (expo-blur)
 *   blur unsupported                → translucent <View>
 *
 * On top of the blur we paint the Aurora "glass fill" gradient + a hairline
 * border so cards read identically to the web on every platform. This is the
 * building block for GlassCard and most surfaces.
 */
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, gradients, radii, vert } from "@/theme";

const LIQUID_GLASS = isLiquidGlassAvailable();

export interface GlassSurfaceProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Corner radius. Default radii.xl (18). */
  radius?: number;
  /** Use the teal accent border instead of the neutral hairline. */
  accent?: boolean;
  /** BlurView intensity (ignored on the liquid-glass path). Default 24. */
  intensity?: number;
  /** Drop the gradient + border overlay (e.g. when the parent draws its own). */
  bare?: boolean;
}

export function GlassSurface({
  children,
  style,
  radius = radii.xl,
  accent = false,
  intensity = 24,
  bare = false,
}: GlassSurfaceProps) {
  const borderColor = accent ? colors.borderAccent : colors.border;
  const shape: ViewStyle = { borderRadius: radius, overflow: "hidden" };

  const overlay = bare ? null : (
    <>
      <LinearGradient
        colors={gradients.glassFill}
        start={vert.start}
        end={vert.end}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: radius, borderWidth: StyleSheet.hairlineWidth + 0.5, borderColor },
        ]}
      />
    </>
  );

  if (LIQUID_GLASS) {
    return (
      <GlassView glassEffectStyle="regular" style={[shape, style]}>
        {overlay}
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView intensity={intensity} tint="dark" style={[shape, style]}>
      {/* Slight dark wash so the blur reads on near-black backgrounds. */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(19,20,24,0.55)" }]}
      />
      {overlay}
      {children}
    </BlurView>
  );
}
