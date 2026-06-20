/** Square outline icon button (e.g. the back button in detail nav bars). */
import { type ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";

import { colors } from "@/theme";

export function IconButton({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.white10,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
});
