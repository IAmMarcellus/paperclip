/** Circular avatar — gradient background with initials (or an image). */
import { LinearGradient } from "expo-linear-gradient";
import { Image, StyleSheet, Text, View } from "react-native";

import { diag, fontFamily, radii } from "@/theme";

export interface AvatarProps {
  /** Two gradient stops; defaults to a sky→blue pair. */
  gradient?: readonly [string, string];
  /** Source string used to derive initials when no name passed. */
  name?: string;
  imageUri?: string | null;
  size?: number;
}

export function Avatar({
  gradient = ["#7eb6e3", "#1f4dd6"],
  name = "",
  imageUri,
  size = 38,
}: AvatarProps) {
  const radius = radii.pill;
  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: radius, overflow: "hidden" }}>
      <LinearGradient colors={gradient} start={diag.start} end={diag.end} style={StyleSheet.absoluteFill} />
      <View style={styles.center}>
        <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{initials(name)}</Text>
      </View>
    </View>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const styles = StyleSheet.create({
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: "#fff", fontFamily: fontFamily.sansBold },
});
