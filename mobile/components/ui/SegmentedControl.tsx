/**
 * SegmentedControl — the Aurora pill toggle (Activity screen: Approvals | Stream).
 * Active segment gets the teal→indigo gradient; inactive is muted text.
 */
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, diag, fontFamily, gradients, radii } from "@/theme";

export interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.track}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable key={opt.value} style={styles.segment} onPress={() => onChange(opt.value)}>
            {active && (
              <LinearGradient
                colors={gradients.accent}
                start={diag.start}
                end={diag.end}
                style={[StyleSheet.absoluteFill, { borderRadius: radii.md }]}
              />
            )}
            <Text
              style={[styles.label, { color: active ? colors.primaryForeground : colors.mutedForeground }]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: radii.lg,
    backgroundColor: colors.white05,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: radii.md,
    overflow: "hidden",
  },
  label: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 13.5,
  },
});
