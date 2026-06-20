/**
 * ActivityFeed — a glass card containing a list of recent events, each a dot +
 * agent/action text + timestamp. Used on Home (recent) and Activity (stream).
 */
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { GlassCard } from "@/components/ui/GlassCard";
import { Separator } from "@/components/ui/Separator";
import { colors, fontFamily, radii, text } from "@/theme";

export type ActivityKind = "ship" | "error" | "approval" | "budget" | "info";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  agent?: string;
  text: string;
  time: string;
}

const KIND_COLOR: Record<ActivityKind, string> = {
  ship: colors.emerald,
  error: colors.rose,
  approval: colors.sky,
  budget: colors.amber,
  info: colors.mutedForeground,
};

export function ActivityRow({ item, index = 0 }: { item: ActivityItem; index?: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 40).duration(320)} style={styles.row}>
      <View style={[styles.dot, { backgroundColor: KIND_COLOR[item.kind] }]} />
      <View style={styles.body}>
        <Text style={text.small} numberOfLines={2}>
          {item.agent ? <Text style={styles.agent}>{item.agent} </Text> : null}
          <Text style={styles.action}>{item.text}</Text>
        </Text>
      </View>
      <Text style={styles.time}>{item.time}</Text>
    </Animated.View>
  );
}

export const ActivityFeed = memo(function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <GlassCard padding={4}>
      <View style={styles.list}>
        {items.map((item, i) => (
          <View key={item.id}>
            <ActivityRow item={item} index={i} />
            {i < items.length - 1 ? <Separator /> : null}
          </View>
        ))}
        {items.length === 0 ? (
          <Text style={[text.small, styles.empty]}>No recent activity.</Text>
        ) : null}
      </View>
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  list: { paddingHorizontal: 12 },
  empty: { paddingVertical: 18, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  dot: { width: 7, height: 7, borderRadius: radii.pill, marginTop: 2 },
  body: { flex: 1, minWidth: 0 },
  agent: { fontFamily: fontFamily.sansSemibold, color: colors.foreground },
  action: { color: colors.mutedForeground },
  time: { fontFamily: fontFamily.mono, fontSize: 10, color: colors.dimForeground },
});
