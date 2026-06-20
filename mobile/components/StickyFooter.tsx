/**
 * StickyFooter — absolutely-positioned bottom bar that owns its safe-area inset.
 * Used by detail screens for sticky actions (Pause/Resume, Cancel run).
 */
import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing } from "@/theme";

export function StickyFooter({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>{children}</View>;
}

const styles = StyleSheet.create({
  footer: {
    position: "absolute",
    left: spacing[5],
    right: spacing[5],
    bottom: 0,
    paddingTop: 10,
  },
});
