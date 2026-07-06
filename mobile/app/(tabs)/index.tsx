import { router } from "expo-router";
import { Bell, ChevronRight } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ActivityFeed } from "@/components/aurora/ActivityFeed";
import { AgentCapsule } from "@/components/aurora/AgentCapsule";
import { CommandBar } from "@/components/aurora/CommandBar";
import { ObjectiveCard } from "@/components/aurora/ObjectiveCard";
import { Screen } from "@/components/Screen";
import { Avatar } from "@/components/ui/Avatar";
import { GlassCard } from "@/components/ui/GlassCard";
import { IconButton } from "@/components/ui/IconButton";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusDot } from "@/components/ui/StatusDot";
import { agentWorkSummary, useActivity, useAgents, useCostsSummary, useGoals, useLiveRuns } from "@/hooks";
import { useConnection } from "@/lib/connection";
import { formatCents, greeting } from "@/lib/format";
import { agentDisplayRole, isWorkingAgent, mapActivity } from "@/lib/ui-map";
import { colors, getAgentStatusVisual, spacing, text } from "@/theme";

export default function HomeScreen() {
  const { companyId, user } = useConnection();
  const cid = companyId ?? "";
  const agents = useAgents(cid);
  const liveRuns = useLiveRuns(cid);
  const activity = useActivity(cid);
  const goals = useGoals(cid);
  const costs = useCostsSummary(cid);

  const working = useMemo(
    () => (agents.data ?? []).filter(isWorkingAgent),
    [agents.data],
  );
  const objective = useMemo(() => agentWorkSummary(agents.data), [agents.data]);
  const topGoal = useMemo(
    () =>
      (goals.data ?? []).find((g) => g.status === "active" && g.level === "company") ??
      (goals.data ?? [])[0],
    [goals.data],
  );

  const feed = useMemo(() => mapActivity(activity.data).slice(0, 6), [activity.data]);

  const onRefresh = () =>
    Promise.all([
      agents.refetch(),
      liveRuns.refetch(),
      activity.refetch(),
      goals.refetch(),
      costs.refetch(),
    ]);

  return (
    <Screen
      header={
        <View style={styles.homeHeader}>
          <View style={styles.headerCopy}>
            <Text style={[text.small, styles.greeting]}>
              {greeting()}
              {user?.name ? `, ${user.name.split(" ")[0]}` : ""}
            </Text>
            <Text style={text.displayLg}>Command</Text>
          </View>
          <View style={styles.headerActions}>
            <IconButton onPress={() => router.push("/activity")}>
              <Bell size={18} color={colors.foregroundSoft} />
              {pendingDot(liveRuns.data?.length ?? 0)}
            </IconButton>
            <Pressable
              onPress={() => router.push("/settings")}
              style={({ pressed }) => [styles.avatarPress, pressed ? styles.pressed : null]}
            >
              <Avatar name={user?.name ?? "You"} imageUri={user?.image} size={38} />
            </Pressable>
          </View>
        </View>
      }
      onRefresh={onRefresh}
    >
      <CommandBar />

      <View style={styles.block}>
        <ObjectiveCard
          label="Root objective"
          title={topGoal?.title ?? "Agents at work"}
          progress={objective.ratio}
          value={objective.value}
          metrics={[
            { value: `${working.length}/${agents.data?.length ?? 0}`, label: "agents active" },
            {
              value: costs.data ? formatCents(costs.data.spendCents) : objective.value,
              label: costs.data?.budgetCents ? `of ${formatCents(costs.data.budgetCents)}` : "workload",
              align: "right",
            },
          ]}
        />
      </View>

      <View style={styles.block}>
        <SectionLabel
          trailing={
            <View style={styles.agentsTrail}>
              <Text style={[text.small, styles.sectionTrail]}>{working.length} live</Text>
              <ChevronRight size={14} color={colors.dimForeground} />
            </View>
          }
        >
          Agents at work
        </SectionLabel>
        {agents.isLoading ? (
          <View style={styles.capsRow}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width={116} height={147} radius={20} />
            ))}
          </View>
        ) : working.length === 0 ? (
          <GlassCard padding={18} radius={20}>
            <Text style={[text.small, styles.emptyState]}>No agents are working right now.</Text>
          </GlassCard>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.capsScroll}
            style={styles.bleedScroll}
          >
            {working.map((a) => {
              const status = getAgentStatusVisual(a.status);
              return (
                <Pressable
                  key={a.id}
                  style={({ pressed }) => [styles.capPress, pressed ? styles.pressed : null]}
                  onPress={() => router.push(`/agents/${a.id}`)}
                >
                  <GlassCard radius={20} padding={14} style={styles.capCard}>
                    <AgentCapsule agent={a} status={a.status} width={24} height={64} />
                    <View style={styles.capNameRow}>
                      <StatusDot color={status.color} size={6} pulse={status.animate} />
                      <Text style={text.smallMedium} numberOfLines={1}>
                        {a.name}
                      </Text>
                    </View>
                    <Text style={[text.mono, styles.capRole]} numberOfLines={1}>
                      {agentDisplayRole(a)}
                    </Text>
                  </GlassCard>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      <View style={styles.block}>
        <SectionLabel
          trailing={
            <View style={styles.liveTrail}>
              <StatusDot color={colors.emerald} size={6} pulse />
              <Text style={[text.label, styles.liveText]}>live</Text>
            </View>
          }
        >
          Live activity
        </SectionLabel>
        {activity.isLoading ? (
          <Skeleton width="100%" height={160} radius={20} />
        ) : (
          <ActivityFeed items={feed.slice(0, 4)} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  homeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  headerCopy: { flex: 1 },
  greeting: { color: colors.dimForeground, marginBottom: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  avatarPress: { borderRadius: 19 },
  block: { marginTop: spacing[5] },
  capsRow: { flexDirection: "row", gap: spacing[3] },
  bleedScroll: { marginHorizontal: -18 },
  capsScroll: { gap: spacing[3], paddingHorizontal: 18, paddingBottom: 4 },
  capPress: { width: 116 },
  capCard: {
    minHeight: 147,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  capNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "stretch",
  },
  capRole: { color: colors.dimForeground, textAlign: "center", alignSelf: "stretch" },
  sectionTrail: { color: colors.dimForeground },
  agentsTrail: { flexDirection: "row", alignItems: "center", gap: 2 },
  liveTrail: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveText: { color: colors.emerald },
  emptyState: { color: colors.dimForeground, textAlign: "center" },
  pressed: { opacity: 0.7 },
  notificationDot: {
    position: "absolute",
    right: 9,
    top: 9,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.teal,
    borderWidth: 1,
    borderColor: colors.background,
  },
});

function pendingDot(count: number) {
  return count > 0 ? <View style={styles.notificationDot} /> : null;
}
