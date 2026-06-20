/**
 * AuroraBackground — the ambient canvas behind every screen: a near-black base
 * with two large, slowly drifting radial "orbs" (teal top-right, indigo
 * bottom-left). Mirrors the web's --background radial glows + pp-drift.
 *
 * Rendered once in the root layout, behind the navigator.
 */
import { useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { colors } from "@/theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const ORB = Math.max(SCREEN_W, SCREEN_H) * 1.1;

function Orb({
  color,
  opacity,
  top,
  left,
  delay,
  reverse,
}: {
  color: string;
  opacity: number;
  top: number;
  left: number;
  delay: number;
  reverse?: boolean;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: reverse ? 20000 : 16000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [t, reverse]);

  const style = useAnimatedStyle(() => {
    const d = reverse ? -t.value : t.value;
    return {
      transform: [
        { translateX: d * 0.04 * SCREEN_W },
        { translateY: d * 0.05 * SCREEN_H },
        { scale: 1 + t.value * 0.08 },
      ],
    };
  });

  return (
    <Animated.View style={[{ position: "absolute", top, left, width: ORB, height: ORB }, style]}>
      <Svg width={ORB} height={ORB}>
        <Defs>
          <RadialGradient id={`g${delay}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
            <Stop offset="55%" stopColor={color} stopOpacity={opacity * 0.4} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={ORB} height={ORB} fill={`url(#g${delay})`} />
      </Svg>
    </Animated.View>
  );
}

export function AuroraBackground() {
  return (
    <View style={styles.fill} pointerEvents="none">
      <Orb color={colors.teal} opacity={0.16} top={-ORB * 0.35} left={SCREEN_W - ORB * 0.55} delay={1} />
      <Orb
        color={colors.indigo}
        opacity={0.13}
        top={SCREEN_H - ORB * 0.5}
        left={-ORB * 0.4}
        delay={2}
        reverse
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
});
