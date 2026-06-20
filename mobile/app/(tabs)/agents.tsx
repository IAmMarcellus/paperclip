import { router } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Plus } from "lucide-react-native";

import { MiniCapsule } from "@/components/aurora/AgentCapsule";
import { AgentStatusBadge } from "@/components/aurora/StatusBadge";
import { Screen } from "@/components/Screen";
import { IconButton } from "@/components/ui/IconButton";
import { ListRow } from "@/components/ui/ListRow";
import { RowsCard } from "@/components/ui/RowsCard";
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
      headerRight={
        <IconButton onPress={() => router.push("/agents/new")}>
          <Plus size={20} color={colors.teal} />
        </IconButton>
      }
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
          <RowsCard
            items={list}
            keyExtractor={(a) => a.id}
            renderRow={(a) => (
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
            )}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: spacing[5] },
});
