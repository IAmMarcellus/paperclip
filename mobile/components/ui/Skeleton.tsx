/** Shimmering loading placeholder. */
import { useEffect } from "react";
import { type DimensionValue, StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { colors, radii } from "@/theme";

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
}

export function Skeleton({ width = "100%", height = 16, radius = radii.sm }: SkeletonProps) {
  const o = useSharedValue(0.4);
  useEffect(() => {
    o.value = withRepeat(withTiming(0.8, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      style={[styles.base, { width, height, borderRadius: radius }, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.white08 },
});
