import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ActivityFeed } from "@/components/aurora/ActivityFeed";
import { AgentCapsule } from "@/components/aurora/AgentCapsule";
import { CommandBar } from "@/components/aurora/CommandBar";
import { ObjectiveCard } from "@/components/aurora/ObjectiveCard";
import { Screen } from "@/components/Screen";
import { Avatar } from "@/components/ui/Avatar";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Skeleton } from "@/components/ui/Skeleton";
import { useActivity, useAgents, useLiveRuns } from "@/hooks";
import { useConnection } from "@/lib/connection";
import { greeting } from "@/lib/format";
import { mapActivity } from "@/lib/ui-map";
import { colors, spacing, text } from "@/theme";

export default function HomeScreen() {
  const { companyId, user } = useConnection();
  const cid = companyId ?? "";
  const agents = useAgents(cid);
  const liveRuns = useLiveRuns(cid);
  const activity = useActivity(cid);

  const working = useMemo(
    () => (agents.data ?? []).filter((a) => a.status === "running" || a.status === "active"),
    [agents.data],
  );
  const objective = useMemo(() => {
    const all = agents.data ?? [];
    const ratio = all.length ? working.length / all.length : 0;
    return {
      ratio,
      value: `${Math.round(ratio * 100)}%`,
      context: `${working.length} of ${all.length} agents active`,
    };
  }, [agents.data, working.length]);

  const feed = useMemo(() => mapActivity(activity.data).slice(0, 6), [activity.data]);

  const refreshing = agents.isRefetching || liveRuns.isRefetching || activity.isRefetching;
  const onRefresh = () => {
    agents.refetch();
    liveRuns.refetch();
    activity.refetch();
  };

  return (
    <Screen
      eyebrow={`${greeting()}${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
      title="Command"
      headerRight={
        <Pressable onPress={() => router.push("/(tabs)/settings")}>
          <Avatar name={user?.name ?? "You"} imageUri={user?.image} size={38} />
        </Pressable>
      }
      onRefresh={onRefresh}
      refreshing={refreshing}
    >
      <CommandBar />

      <View style={styles.block}>
        <ObjectiveCard
          label="Operations"
          title="Agents at work"
          progress={objective.ratio}
          value={objective.value}
          context={objective.context}
        />
      </View>

      <View style={styles.block}>
        <SectionLabel trailing={<Text style={text.mono}>{working.length}</Text>}>
          Agents at work
        </SectionLabel>
        {agents.isLoading ? (
          <View style={styles.capsRow}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width={116} height={64} radius={16} />
            ))}
          </View>
        ) : working.length === 0 ? (
          <Text style={text.small}>No agents are working right now.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.capsRow}>
              {working.map((a) => (
                <Pressable
                  key={a.id}
                  style={styles.capCell}
                  onPress={() => router.push(`/agents/${a.id}`)}
                >
                  <AgentCapsule agent={a} status={a.status} width={26} height={44} />
                  <View style={styles.capMeta}>
                    <Text style={[text.smallMedium]} numberOfLines={1}>
                      {a.name}
                    </Text>
                    <Text style={[text.mono, { color: colors.dimForeground }]} numberOfLines={1}>
                      {a.title ?? a.role}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      <View style={styles.block}>
        <SectionLabel>Live activity</SectionLabel>
        {activity.isLoading ? (
          <Skeleton width="100%" height={160} radius={20} />
        ) : (
          <ActivityFeed items={feed} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: spacing[6] },
  capsRow: { flexDirection: "row", gap: spacing[3] },
  capCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingRight: spacing[3],
  },
  capMeta: { maxWidth: 90 },
});
