/**
 * AgentCapsule — the signature Aurora element: a rounded pill in the agent's
 * stable gradient that gently "breathes". Used large (Home capsules, Agent
 * Detail hero) and mini (list-row indicator).
 *
 * States: working/active → gradient + breathe + shine; idle → dashed outline,
 * no glow; error → rose gradient.
 */
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { agentGradientStops, gradients, radii, vert } from "@/theme";

export interface AgentCapsuleProps {
  /** Agent id/name (drives the stable gradient) or an explicit agent object. */
  agent: { id?: string | null; name?: string | null } | string;
  status?: string | null;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function AgentCapsule({
  agent,
  status,
  width = 24,
  height = 64,
  style,
}: AgentCapsuleProps) {
  const breathe = useSharedValue(0);
  const idle = status === "idle" || status === "archived";
  const error = status === "error";

  useEffect(() => {
    if (idle) {
      breathe.value = 0;
      return;
    }
    breathe.value = withRepeat(
      withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [idle, breathe]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.82 + breathe.value * 0.18,
  }));

  const stops = error ? gradients.error : agentGradientStops(agent);

  if (idle) {
    return (
      <View
        style={[
          styles.capsule,
          styles.idle,
          { width, height, borderRadius: radii.pill },
          style,
        ]}
      />
    );
  }

  return (
    <Animated.View
      style={[
        styles.capsule,
        {
          width,
          height,
          borderRadius: radii.pill,
          shadowColor: stops[1],
          shadowOpacity: 0.55,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
          elevation: 6,
        },
        animatedStyle,
        style,
      ]}
    >
      <LinearGradient
        colors={stops as readonly [string, string]}
        start={vert.start}
        end={vert.end}
        style={[StyleSheet.absoluteFill, { borderRadius: radii.pill }]}
      />
      {/* Shine highlight near the top, like the mockup. */}
      <View
        pointerEvents="none"
        style={[
          styles.shine,
          { left: width * 0.26, right: width * 0.26, height: height * 0.24, borderRadius: radii.pill },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  capsule: { overflow: "visible", position: "relative" },
  idle: { borderWidth: 1.5, borderColor: "rgba(255,255,255,0.22)", borderStyle: "dashed" },
  shine: {
    position: "absolute",
    top: 5,
    backgroundColor: "rgba(255,255,255,0.42)",
    opacity: 0.7,
  },
});

/** Thin variant for list rows. */
export function MiniCapsule({
  agent,
  status,
  height = 34,
}: {
  agent: AgentCapsuleProps["agent"];
  status?: string | null;
  height?: number;
}) {
  return <AgentCapsule agent={agent} status={status} width={6} height={height} />;
}
