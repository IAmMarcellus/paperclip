/**
 * RowsCard — a glass card wrapping a list of rows with hairline separators
 * between them. Consolidates the repeated "GlassCard > padded list > map with a
 * divider between items" pattern (agents list, settings companies, recent runs).
 */
import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { GlassCard } from "./GlassCard";
import { Separator } from "./Separator";
import { radii, spacing } from "@/theme";

export interface RowsCardProps<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  renderRow: (item: T) => ReactNode;
  radius?: number;
}

export function RowsCard<T>({ items, keyExtractor, renderRow, radius = radii["2xl"] }: RowsCardProps<T>) {
  return (
    <GlassCard padding={4} radius={radius}>
      <View style={styles.list}>
        {items.map((item, i) => (
          <View key={keyExtractor(item)}>
            {renderRow(item)}
            {i < items.length - 1 ? <Separator /> : null}
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing[3] },
});
