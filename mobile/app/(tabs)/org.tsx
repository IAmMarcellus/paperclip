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
import { useAgents, useOrg } from "@/hooks";
import { useConnection } from "@/lib/connection";
import { humanize } from "@/lib/format";
import type { OrgNode } from "@/lib/api/types";
import { colors, spacing, text } from "@/theme";

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
  return (
    <View>
      <View style={[styles.rowWrap, { marginLeft: level * 16 }]}>
        {level > 0 ? <View style={styles.connector} /> : null}
        <GlassCard padding={4} radius={14} style={styles.nodeCard}>
          <View style={styles.nodePad}>
            <ListRow
              onPress={() => router.push(`/agents/${node.id}`)}
              leading={<MiniCapsule agent={{ id: node.id, name: node.name }} status={node.status} height={28} />}
            >
              <Text style={text.smallMedium} numberOfLines={1}>
                {node.name}
              </Text>
              <Text style={[text.mono, { color: colors.dimForeground }]} numberOfLines={1}>
                {node.title ?? humanize(node.role)}
                {children.length ? ` · ${children.length} report${children.length > 1 ? "s" : ""}` : ""}
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

export default function OrgScreen() {
  const { companyId } = useConnection();
  const org = useOrg(companyId ?? "");
  const agents = useAgents(companyId ?? "");
  const tree = org.data ?? [];

  const meta = useMemo(() => walk(tree), [tree]);
  const objective = useMemo(() => {
    const all = agents.data ?? [];
    const working = all.filter((a) => a.status === "running" || a.status === "active").length;
    const ratio = all.length ? working / all.length : 0;
    return { ratio, value: `${Math.round(ratio * 100)}%`, context: `${working} of ${all.length} agents active` };
  }, [agents.data]);

  return (
    <Screen
      eyebrow={`${meta.count} nodes · depth ${meta.depth}`}
      title="Org map"
      onRefresh={() => {
        org.refetch();
        agents.refetch();
      }}
      refreshing={org.isRefetching}
    >
      <ObjectiveCard
        label="Mission"
        title="Organization"
        progress={objective.ratio}
        value={objective.value}
        context={objective.context}
        big
      />

      <View style={styles.tree}>
        <SectionLabel>Chain of command</SectionLabel>
        {org.isLoading ? (
          <Skeleton width="100%" height={200} radius={16} />
        ) : tree.length === 0 ? (
          <Text style={text.small}>No org structure yet.</Text>
        ) : (
          tree.map((n) => <OrgRow key={n.id} node={n} level={0} />)
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  nodeCard: {},
  nodePad: { paddingHorizontal: 12 },
});
