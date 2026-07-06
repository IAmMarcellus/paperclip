/**
 * ListRow — a tappable row used inside glass list cards (agents list, org tree,
 * recent actions). Leading slot (capsule/dot), content, trailing slot, chevron.
 */
import { ChevronRight } from "lucide-react-native";
import { type ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, spacing } from "@/theme";

export interface ListRowProps {
  leading?: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ListRow({ leading, children, trailing, onPress, chevron = true, style }: ListRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && onPress ? styles.pressed : null, style]}
    >
      {leading}
      <View style={styles.content}>{children}</View>
      {trailing}
      {chevron && onPress ? <ChevronRight size={16} color={colors.dimForeground} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: 12,
  },
  content: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.6 },
});
