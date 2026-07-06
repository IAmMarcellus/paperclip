import { router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Search, SlidersHorizontal } from "lucide-react-native";

import { MiniCapsule } from "@/components/aurora/AgentCapsule";
import { StatGrid } from "@/components/aurora/StatGrid";
import { Screen } from "@/components/Screen";
import { Badge } from "@/components/ui/Badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { IconButton } from "@/components/ui/IconButton";
import { ListRow } from "@/components/ui/ListRow";
import { PropertySheet, type SheetOption } from "@/components/ui/PropertySheet";
import { RowsCard } from "@/components/ui/RowsCard";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusDot } from "@/components/ui/StatusDot";
import { useAgents } from "@/hooks";
import { useConnection } from "@/lib/connection";
import type { Agent } from "@/lib/api/types";
import { agentDisplayRole, agentMetric, agentTaskText, isWorkingAgent } from "@/lib/ui-map";
import { humanize } from "@/lib/format";
import { colors, fontFamily, getAgentStatusVisual, spacing, text } from "@/theme";

type AgentFilter = "all" | "working" | "idle" | "error";

const FILTER_OPTIONS: SheetOption[] = [
  { value: "all", label: "All agents", color: colors.teal },
  { value: "working", label: "Working", color: colors.emerald },
  { value: "idle", label: "Idle", color: colors.statusIdle },
  { value: "error", label: "Error", color: colors.rose },
];

export default function AgentsScreen() {
  const { companyId } = useConnection();
  const agents = useAgents(companyId ?? "");
  const [filter, setFilter] = useState<AgentFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const list = useMemo(() => agents.data ?? [], [agents.data]);

  const stats = useMemo(() => {
    const working = list.filter(isWorkingAgent).length;
    const error = list.filter((a) => a.status === "error").length;
    const idle = list.length - working - error;
    return [
      { value: String(working), label: "Working", tint: colors.teal },
      { value: String(idle), label: "Idle", tint: colors.mutedForeground },
      { value: String(error), label: "Error", tint: colors.rose },
    ];
  }, [list]);

  const filtered = useMemo(
    () =>
      list.filter((agent) => {
        if (filter === "working") return isWorkingAgent(agent);
        if (filter === "error") return agent.status === "error";
        if (filter === "idle") return !isWorkingAgent(agent) && agent.status !== "error";
        return true;
      }),
    [filter, list],
  );

  const sectionTitle =
    filter === "all" ? `All agents · ${filtered.length}` : `${humanize(filter)} agents · ${filtered.length}`;

  return (
    <>
      <Screen
        header={
          <View style={styles.screenHeader}>
            <View style={styles.headerCopy}>
              <Text style={text.displayLg}>Agents</Text>
              <Text style={[text.small, styles.headerMeta]}>{list.length} operating agents</Text>
            </View>
            <View style={styles.headerActions}>
              <IconButton onPress={() => router.push("/search")}>
                <Search size={19} color={colors.foregroundSoft} />
              </IconButton>
              <IconButton onPress={() => setFilterOpen(true)}>
                <SlidersHorizontal
                  size={19}
                  color={filter === "all" ? colors.foregroundSoft : colors.teal}
                />
              </IconButton>
            </View>
          </View>
        }
        onRefresh={() => agents.refetch()}
      >
        {agents.isLoading ? (
          <Skeleton width="100%" height={86} radius={16} />
        ) : (
          <StatGrid items={stats} columns={3} align="center" />
        )}

        <View style={styles.block}>
          <SectionLabel
            trailing={
              filter !== "all" ? (
                <Badge label={humanize(filter)} tint={colors.teal} />
              ) : undefined
            }
          >
            {sectionTitle}
          </SectionLabel>
          {agents.isLoading ? (
            <Skeleton width="100%" height={240} radius={20} />
          ) : list.length === 0 ? (
            <EmptyCard message="No agents yet." />
          ) : filtered.length === 0 ? (
            <EmptyCard message={`No ${filter} agents.`} />
          ) : (
            <RowsCard
              items={filtered}
              keyExtractor={(a) => a.id}
              renderRow={(a) => (
                <AgentRow agent={a} />
              )}
            />
          )}
        </View>
      </Screen>
      <PropertySheet
        visible={filterOpen}
        title="Filter agents"
        options={FILTER_OPTIONS}
        selected={filter}
        onSelect={(value) => setFilter(value as AgentFilter)}
        onClose={() => setFilterOpen(false)}
      />
    </>
  );
}

function AgentRow({ agent }: { agent: Agent }) {
  const status = getAgentStatusVisual(agent.status);
  const metric = agentMetric(agent);
  const role = agentDisplayRole(agent);
  return (
    <ListRow
      onPress={() => router.push(`/agents/${agent.id}`)}
      leading={<MiniCapsule agent={agent} status={agent.status} height={34} />}
      trailing={
        <View style={styles.metric}>
          <Text style={[styles.metricValue, metric.warn ? styles.metricWarn : null]} numberOfLines={1}>
            {metric.value}
          </Text>
          <Text style={[text.label, styles.metricLabel]} numberOfLines={1}>
            {metric.label}
          </Text>
        </View>
      }
    >
      <View style={styles.nameRow}>
        <StatusDot color={status.color} size={7} pulse={status.animate} />
        <Text style={[text.title, styles.agentName]} numberOfLines={1}>
          {agent.name}
        </Text>
        <Text style={[text.small, styles.role]} numberOfLines={1}>
          {role}
        </Text>
      </View>
      <Text style={[text.small, styles.taskText]} numberOfLines={1}>
        {agentTaskText(agent)}
      </Text>
    </ListRow>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <GlassCard padding={18} radius={20}>
      <Text style={[text.small, styles.empty]}>{message}</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  headerCopy: { flex: 1 },
  headerMeta: { color: colors.dimForeground, marginTop: 3 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  block: { marginTop: spacing[5] },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  agentName: { flexShrink: 1, minWidth: 0 },
  role: { color: colors.dimForeground },
  taskText: { color: colors.mutedForeground, marginTop: 2 },
  metric: { alignItems: "flex-end", minWidth: 48 },
  metricValue: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  metricWarn: { color: colors.amber },
  metricLabel: { color: colors.dimForeground, fontSize: 10 },
  empty: { color: colors.dimForeground, textAlign: "center" },
});
