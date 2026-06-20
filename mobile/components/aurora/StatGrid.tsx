/**
 * StatGrid — a wrapping grid of small glass stat cards (count + label).
 * Agents screen uses 3 columns; Agent Detail uses 2.
 */
import { StyleSheet, Text, View } from "react-native";

import { GlassCard } from "@/components/ui/GlassCard";
import { colors, fontFamily, text } from "@/theme";

export interface StatItem {
  value: string;
  label: string;
  /** Optional accent colour for the value (e.g. status colour). */
  tint?: string;
}

export function StatGrid({ items, columns = 3 }: { items: StatItem[]; columns?: number }) {
  return (
    <View style={styles.grid}>
      {items.map((item, i) => (
        <View key={i} style={{ width: `${100 / columns}%` }}>
          <View style={styles.cell}>
            <GlassCard padding={14} radius={16}>
              <Text style={[styles.value, item.tint ? { color: item.tint } : null]}>{item.value}</Text>
              <Text style={text.label}>{item.label}</Text>
            </GlassCard>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 },
  cell: { paddingHorizontal: 5, paddingBottom: 10 },
  value: {
    fontFamily: fontFamily.displayBold,
    fontSize: 24,
    color: colors.foreground,
    marginBottom: 4,
  },
});
