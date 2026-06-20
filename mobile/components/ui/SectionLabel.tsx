/** Mono uppercase section heading, optionally with a trailing count/accessory. */
import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { text } from "@/theme";

export function SectionLabel({
  children,
  trailing,
}: {
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Text style={text.label}>{children}</Text>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
});
