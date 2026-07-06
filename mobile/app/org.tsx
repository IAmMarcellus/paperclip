import { router } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { MiniCapsule } from "@/components/aurora/AgentCapsule";
import { ObjectiveCard } from "@/components/aurora/ObjectiveCard";
import { Screen } from "@/components/Screen";
import { GlassCard } from "@/components/ui/GlassCard";
import { ListRow } from "@/components/ui/ListRow";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusDot } from "@/components/ui/StatusDot";
import { agentWorkSummary, useAgents, useCostsSummary, useGoals, useOrg } from "@/hooks";
import { useConnection } from "@/lib/connection";
import { formatCents, humanize } from "@/lib/format";
import type { OrgNode } from "@/lib/api/types";
import { colors, getAgentStatusVisual, spacing, text } from "@/theme";

function walk(nodes: OrgNode[], depth = 1): { count: number; depth: number } {
  let count = 0;
  let max = depth - 1;
  for (const n of nodes) {
    count += 1;
    const child = walk(n.children ?? [], depth + 1);
    count += child.count;
    max = Math.max(max, n.children?.length ? child.depth : depth);
  }
  return { count, depth: max };
}

function OrgRow({ node, level }: { node: OrgNode; level: number }) {
  const children = node.children ?? [];
  const status = getAgentStatusVisual(node.status);
  const metric = nodeMetric(node);
  return (
    <View>
      <View style={[styles.rowWrap, { marginLeft: level * 16 }]}>
        {level > 0 ? <View style={styles.connector} /> : null}
        <GlassCard padding={4} radius={14}>
          <View style={styles.nodePad}>
            <ListRow
              onPress={() => router.push(`/agents/${node.id}`)}
              leading={<MiniCapsule agent={{ id: node.id, name: node.name }} status={node.status} height={28} />}
              trailing={
                <View style={styles.nodeMetric}>
                  <Text style={[text.mono, metric.warn ? styles.metricWarn : null]} numberOfLines={1}>
                    {metric.value}
                  </Text>
                  <Text style={[text.label, styles.nodeMetricLabel]} numberOfLines={1}>
                    {metric.label}
                  </Text>
                </View>
              }
            >
              <View style={styles.nameLine}>
                <StatusDot color={status.color} size={6} pulse={status.animate} />
                <Text style={text.smallMedium} numberOfLines={1}>
                  {node.name}
                </Text>
                <Text style={[text.small, styles.roleText]} numberOfLines={1}>
                  {node.title ?? humanize(node.role)}
                </Text>
              </View>
              <Text style={text.small} numberOfLines={1}>
                {children.length ? `${children.length} report${children.length > 1 ? "s" : ""}` : status.label}
              </Text>
            </ListRow>
          </View>
        </GlassCard>
      </View>
      {children.map((c) => (
        <OrgRow key={c.id} node={c} level={level + 1} />
      ))}
    </View>
  );
}

function ChiefRow({ node }: { node: OrgNode }) {
  const children = node.children ?? [];
  const status = getAgentStatusVisual(node.status);
  return (
    <GlassCard radius={16} padding={0} style={styles.chiefCard}>
      <View style={styles.nodePad}>
        <ListRow
          onPress={() => router.push(`/agents/${node.id}`)}
          leading={<MiniCapsule agent={{ id: node.id, name: node.name }} status={node.status} height={32} />}
        >
          <View style={styles.nameLine}>
            <StatusDot color={status.color} size={7} pulse={status.animate} />
            <Text style={text.title} numberOfLines={1}>
              {node.name}
            </Text>
            <Text style={[text.label, styles.chiefLabel]}>Chief</Text>
          </View>
          <Text style={[text.small, styles.chiefMeta]} numberOfLines={1}>
            {node.title ?? humanize(node.role)}
            {children.length ? ` · ${children.length} report${children.length > 1 ? "s" : ""}` : ""}
          </Text>
        </ListRow>
      </View>
    </GlassCard>
  );
}

export default function OrgScreen() {
  const { companyId } = useConnection();
  const org = useOrg(companyId ?? "");
  const agents = useAgents(companyId ?? "");
  const goals = useGoals(companyId ?? "");
  const costs = useCostsSummary(companyId ?? "");
  const tree = useMemo(() => org.data ?? [], [org.data]);
  const chief = tree[0];
  const reports = chief ? chief.children ?? [] : [];

  const meta = useMemo(() => walk(tree), [tree]);
  const objective = useMemo(() => agentWorkSummary(agents.data), [agents.data]);
  const topGoal = useMemo(
    () =>
      (goals.data ?? []).find((g) => g.status === "active" && g.level === "company") ??
      (goals.data ?? [])[0],
    [goals.data],
  );
  const objectiveMetrics = costs.data
    ? [
        { value: formatCents(costs.data.spendCents), label: costs.data.budgetCents ? `of ${formatCents(costs.data.budgetCents)}` : "spend" },
        { value: `${meta.count}`, label: `nodes · depth ${meta.depth}`, align: "right" as const },
      ]
    : [
        { value: String(meta.count), label: "nodes" },
        { value: `depth ${meta.depth}`, label: objective.context, align: "right" as const },
      ];

  return (
    <Screen
      header={
        <View style={styles.screenHeader}>
          <Text style={text.displayLg}>Org map</Text>
          <Text style={[text.small, styles.headerMeta]}>
            {meta.count} nodes · depth {meta.depth}
          </Text>
        </View>
      }
      onBack={() => router.back()}
      onRefresh={() => Promise.all([org.refetch(), agents.refetch()])}
    >
      <ObjectiveCard
        label="Root objective"
        title={topGoal?.title ?? "Organization"}
        progress={objective.ratio}
        value={objective.value}
        metrics={objectiveMetrics}
        big
      />

      <View style={styles.tree}>
        <SectionLabel>Chain of command</SectionLabel>
        {org.isLoading ? (
          <Skeleton width="100%" height={200} radius={16} />
        ) : tree.length === 0 ? (
          <GlassCard padding={18} radius={20}>
            <Text style={[text.small, styles.empty]}>No org structure yet.</Text>
          </GlassCard>
        ) : (
          <>
            <View style={styles.rootConnector} />
            {chief ? <ChiefRow node={chief} /> : null}
            {reports.length ? (
              <View style={styles.reports}>
                <View style={styles.reportRail} />
                {reports.map((n) => (
                  <OrgRow key={n.id} node={n} level={0} />
                ))}
              </View>
            ) : null}
            {!reports.length && tree.length > 1
              ? tree.slice(1).map((n) => <OrgRow key={n.id} node={n} level={0} />)
              : null}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenHeader: { marginBottom: spacing[4] },
  headerMeta: { color: colors.dimForeground, marginTop: 3 },
  tree: { marginTop: spacing[6] },
  rowWrap: { position: "relative", marginBottom: 10 },
  connector: {
    position: "absolute",
    left: -8,
    top: -10,
    width: 1,
    height: "100%",
    backgroundColor: colors.white10,
  },
  nodePad: { paddingHorizontal: 12 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  roleText: { color: colors.dimForeground },
  chiefCard: {
    shadowColor: colors.indigo,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  chiefLabel: { color: colors.dimForeground, fontSize: 9.5 },
  chiefMeta: { color: colors.teal },
  rootConnector: {
    width: 2,
    height: 22,
    marginLeft: 28,
    backgroundColor: colors.teal,
  },
  reports: { marginTop: 4, paddingLeft: 28, position: "relative" },
  reportRail: {
    position: "absolute",
    top: 0,
    bottom: 26,
    left: 28,
    width: 2,
    backgroundColor: colors.white10,
  },
  nodeMetric: { alignItems: "flex-end", minWidth: 42 },
  nodeMetricLabel: { color: colors.dimForeground, fontSize: 10 },
  metricWarn: { color: colors.amber },
  empty: { color: colors.dimForeground, textAlign: "center" },
});

function nodeMetric(node: OrgNode): { value: string; label: string; warn?: boolean } {
  const cpu = nodePercent(node, "cpuPercent", "cpu", "computePercent");
  if (cpu != null) return { value: `${cpu}%`, label: "cpu", warn: cpu >= 60 };
  const children = node.children?.length ?? 0;
  if (children > 0) return { value: String(children), label: children === 1 ? "report" : "reports" };
  return { value: getAgentStatusVisual(node.status).label, label: "status" };
}

function nodePercent(node: OrgNode, ...keys: string[]): number | null {
  const raw = nodeNumber(node, ...keys) ?? nodeNumber(node.metadata, ...keys);
  if (raw == null) return null;
  const value = raw > 0 && raw <= 1 ? raw * 100 : raw;
  return Math.max(0, Math.min(999, Math.round(value)));
}

function nodeNumber(source: unknown, ...keys: string[]): number | null {
  if (typeof source !== "object" || source === null || Array.isArray(source)) return null;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}
