/**
 * Status dot with optional pulse (reanimated). Glows via a colored shadow.
 * Used in list rows, agent headers, activity feed.
 */
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { radii } from "@/theme";

export interface StatusDotProps {
  color: string;
  size?: number;
  /** Pulse (running) — opacity + scale, ~1.6s, like the web hb-pulse. */
  pulse?: boolean;
  glow?: boolean;
}

export function StatusDot({ color, size = 8, pulse = false, glow = true }: StatusDotProps) {
  const p = useSharedValue(1);

  useEffect(() => {
    if (pulse) {
      p.value = withRepeat(
        withTiming(0.5, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(p);
      p.value = 1;
    }
    return () => cancelAnimation(p);
  }, [pulse, p]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + p.value * 0.5,
    transform: [{ scale: 0.82 + p.value * 0.18 }],
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: radii.pill,
          backgroundColor: color,
          shadowColor: glow ? color : "transparent",
          shadowOpacity: glow ? 0.9 : 0,
          shadowRadius: glow ? size : 0,
          shadowOffset: { width: 0, height: 0 },
          elevation: glow ? 4 : 0,
        },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {},
});
