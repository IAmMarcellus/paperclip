import { router } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { MiniCapsule } from "@/components/aurora/AgentCapsule";
import { AgentStatusBadge } from "@/components/aurora/StatusBadge";
import { Screen } from "@/components/Screen";
import { GlassCard } from "@/components/ui/GlassCard";
import { ListRow } from "@/components/ui/ListRow";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatGrid } from "@/components/aurora/StatGrid";
import { useAgents } from "@/hooks";
import { useConnection } from "@/lib/connection";
import { humanize } from "@/lib/format";
import { colors, spacing, text } from "@/theme";

export default function AgentsScreen() {
  const { companyId } = useConnection();
  const agents = useAgents(companyId ?? "");
  const list = agents.data ?? [];

  const stats = useMemo(() => {
    const working = list.filter((a) => a.status === "running" || a.status === "active").length;
    const error = list.filter((a) => a.status === "error").length;
    const idle = list.length - working - error;
    return [
      { value: String(working), label: "Working", tint: colors.teal },
      { value: String(idle), label: "Idle", tint: colors.mutedForeground },
      { value: String(error), label: "Error", tint: colors.rose },
    ];
  }, [list]);

  return (
    <Screen
      title="Agents"
      onRefresh={() => agents.refetch()}
      refreshing={agents.isRefetching}
    >
      {agents.isLoading ? (
        <Skeleton width="100%" height={86} radius={16} />
      ) : (
        <StatGrid items={stats} columns={3} />
      )}

      <View style={styles.block}>
        <SectionLabel trailing={<Text style={text.mono}>{list.length}</Text>}>
          All agents
        </SectionLabel>
        {agents.isLoading ? (
          <Skeleton width="100%" height={240} radius={20} />
        ) : list.length === 0 ? (
          <Text style={text.small}>No agents yet.</Text>
        ) : (
          <GlassCard padding={4} radius={20}>
            <View style={styles.listPad}>
              {list.map((a, i) => (
                <View key={a.id}>
                  <ListRow
                    onPress={() => router.push(`/agents/${a.id}`)}
                    leading={<MiniCapsule agent={a} status={a.status} height={34} />}
                    trailing={<AgentStatusBadge status={a.status} />}
                  >
                    <Text style={text.title} numberOfLines={1}>
                      {a.name}
                    </Text>
                    <Text style={text.small} numberOfLines={1}>
                      {a.title ?? humanize(a.role)}
                    </Text>
                  </ListRow>
                  {i < list.length - 1 ? <View style={styles.divider} /> : null}
                </View>
              ))}
            </View>
          </GlassCard>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: spacing[5] },
  listPad: { paddingHorizontal: 12 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.white05 },
});
