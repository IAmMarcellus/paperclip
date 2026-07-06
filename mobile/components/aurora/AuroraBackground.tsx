/**
 * AuroraBackground — the ambient canvas behind every screen.
 *
 * Matches the standalone Aurora mobile reference: a #0a0c0d phone surface with
 * a teal→indigo radial wash from the upper-right and a softer indigo wash from
 * the lower-left, drifting slowly like the mockup's pp-drift animation.
 */
import { LinearGradient } from "expo-linear-gradient";
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

import { colors, vert } from "@/theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const TOP_GLOW = Math.max(360, SCREEN_W * 0.9);
const BOTTOM_GLOW = Math.max(340, SCREEN_W * 0.85);

function AmbientGlow({
  id,
  size,
  top,
  left,
  stops,
  reverse,
}: {
  id: string;
  size: number;
  top: number;
  left: number;
  stops: { offset: string; color: string; opacity: number }[];
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

  const driftStyle = useAnimatedStyle(() => {
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
    <Animated.View style={[styles.glow, { top, left, width: size, height: size }, driftStyle]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            {stops.map((stop) => (
              <Stop
                key={`${id}-${stop.offset}`}
                offset={stop.offset}
                stopColor={stop.color}
                stopOpacity={stop.opacity}
              />
            ))}
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={size} height={size} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

export function AuroraBackground() {
  return (
    <View style={styles.fill} pointerEvents="none">
      <LinearGradient
        colors={[colors.screen, colors.background]}
        locations={[0, 1]}
        start={vert.start}
        end={vert.end}
        style={StyleSheet.absoluteFill}
      />
      <AmbientGlow
        id="auroraTop"
        size={TOP_GLOW}
        top={-TOP_GLOW * 0.33}
        left={SCREEN_W - TOP_GLOW + SCREEN_W * 0.2}
        stops={[
          { offset: "0%", color: colors.teal, opacity: 0.18 },
          { offset: "45%", color: colors.indigo, opacity: 0.1 },
          { offset: "70%", color: colors.indigo, opacity: 0 },
          { offset: "100%", color: colors.indigo, opacity: 0 },
        ]}
      />
      <AmbientGlow
        id="auroraBottom"
        size={BOTTOM_GLOW}
        top={SCREEN_H - BOTTOM_GLOW + SCREEN_H * 0.16}
        left={-BOTTOM_GLOW * 0.26}
        stops={[
          { offset: "0%", color: colors.indigo, opacity: 0.14 },
          { offset: "58%", color: colors.indigo, opacity: 0.05 },
          { offset: "68%", color: colors.indigo, opacity: 0 },
          { offset: "100%", color: colors.indigo, opacity: 0 },
        ]}
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
    backgroundColor: colors.screen,
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
  },
});
