/**
 * Badge / pill. Either pass a `chip` ({bg,text,border}) from theme/status-colors
 * or a single `tint` colour (renders at brand opacities like the web chips).
 */
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, fontFamily, radii, type ChipStyle } from "@/theme";

export interface BadgeProps {
  label: string;
  chip?: ChipStyle;
  /** Single accent colour; bg/border derived at low opacity. */
  tint?: string;
  /** Small leading dot. */
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Badge({ label, chip, tint = colors.teal, dot, style }: BadgeProps) {
  const bg = chip?.bg ?? withAlpha(tint, 0.13);
  const border = chip?.border ?? withAlpha(tint, 0.3);
  const fg = chip?.text ?? tint;

  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: border }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: fg }]} />}
      <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Append an alpha to a #rrggbb hex (e.g. 0.13 → "21"). */
export function withAlpha(hex: string, alpha: number): string {
  if (!hex.startsWith("#") || hex.length !== 7) return hex;
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  dot: { width: 6, height: 6, borderRadius: radii.pill },
  text: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 11,
    letterSpacing: 0.4,
  },
});
