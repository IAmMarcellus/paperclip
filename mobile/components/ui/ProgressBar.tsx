/** Pill-shaped progress bar with the teal→indigo gradient fill (web parity). */
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, gradients, horiz, radii } from "@/theme";

export interface ProgressBarProps {
  /** 0..1 */
  value: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function ProgressBar({ value, height = 8, style }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={[styles.track, { height, borderRadius: radii.pill }, style]}>
      <View style={{ width: `${pct * 100}%`, height: "100%" }}>
        <LinearGradient
          colors={gradients.accent}
          start={horiz.start}
          end={horiz.end}
          style={[StyleSheet.absoluteFill, { borderRadius: radii.pill }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    backgroundColor: colors.white08,
    overflow: "hidden",
  },
});
