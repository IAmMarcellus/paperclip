/**
 * GlassSurface — the one place that branches on glass capability.
 *
 *   iOS 26 (isLiquidGlassAvailable) → native <GlassView>  (real Liquid Glass)
 *   iOS < 26 / Android              → <BlurView>           (expo-blur)
 *   blur unsupported                → translucent <View>
 *
 * On top of the blur we paint the Aurora "glass fill" gradient so cards read
 * identically to the web on every platform. This is the building block for
 * GlassCard and most surfaces.
 */
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { gradients, radii, vert } from "@/theme";

const LIQUID_GLASS = isLiquidGlassAvailable();

export interface GlassSurfaceProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Corner radius. Default radii.xl (18). */
  radius?: number;
  /** BlurView intensity (ignored on the liquid-glass path). Default 24. */
  intensity?: number;
  /** Drop the gradient overlay (e.g. when the parent draws its own). */
  bare?: boolean;
}

export function GlassSurface({
  children,
  style,
  radius = radii.xl,
  intensity = 24,
  bare = false,
}: GlassSurfaceProps) {
  const shape: ViewStyle = { borderRadius: radius, borderCurve: "continuous", overflow: "hidden" };

  const overlay = bare ? null : (
    <LinearGradient
      colors={gradients.glassFill}
      start={vert.start}
      end={vert.end}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );

  if (LIQUID_GLASS) {
    // Render the native glass as an absolute-fill *background* behind normally
    // laid-out children, rather than nesting children inside <GlassView>. On real
    // iOS 26 hardware the native GlassView clips its children to its own
    // (under-measured) height, so tall content — e.g. a trailing Button — gets cut
    // off at the card's bottom edge. A plain <View> owns layout (and grows to fit
    // its children), mirroring the BlurView path below. (The simulator's GlassView
    // does not clip, which is why this only reproduces on a device.)
    return (
      <View style={[shape, style]}>
        <GlassView
          glassEffectStyle="regular"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {overlay}
        {children}
      </View>
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
