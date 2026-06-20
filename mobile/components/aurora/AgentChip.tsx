/**
 * AgentChip — agent name preceded by a short vertical bar in the agent's
 * signature gradient. Port of vendor/paperclip/ui/src/components/aurora/AgentChip.tsx.
 */
import { LinearGradient } from "expo-linear-gradient";
import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { agentGradientStops, radii, text, vert } from "@/theme";

export interface AgentChipProps {
  agent: { id?: string | null; name?: string | null } | string;
  name?: string;
  trailing?: ReactNode;
}

export function AgentChip({ agent, name, trailing }: AgentChipProps) {
  const label = name ?? (typeof agent === "string" ? agent : agent?.name) ?? "—";
  const stops = agentGradientStops(agent);
  return (
    <View style={styles.row}>
      <View style={styles.bar}>
        <LinearGradient
          colors={stops as readonly [string, string]}
          start={vert.start}
          end={vert.end}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <Text style={[text.bodyMedium, styles.label]} numberOfLines={1}>
        {label}
      </Text>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  bar: { width: 4, height: 14, borderRadius: radii.pill, overflow: "hidden" },
  label: { flexShrink: 1 },
});
