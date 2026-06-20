import { router } from "expo-router";
import { Plus } from "lucide-react-native";
import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { IssueRow, issueRef } from "@/components/aurora/IssueRow";
import { IssueStatusBadge } from "@/components/aurora/StatusBadge";
import { PriorityIcon } from "@/components/aurora/PriorityIcon";
import { Screen } from "@/components/Screen";
import { GlassCard } from "@/components/ui/GlassCard";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Separator } from "@/components/ui/Separator";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAgents, useIssuesInfinite } from "@/hooks";
import { useConnection } from "@/lib/connection";
import type { Issue } from "@/lib/api/types";
import { colors, spacing, text } from "@/theme";

type View2 = "list" | "board";
const BOARD_STATUSES = ["todo", "in_progress", "in_review", "blocked", "done"];

export default function TasksScreen() {
  const { companyId } = useConnection();
  const cid = companyId ?? "";
  const q = useIssuesInfinite(cid);
  const agents = useAgents(cid);
  const [view, setView] = useState<View2>("list");

  const issues = useMemo(() => (q.data?.pages ?? []).flat(), [q.data]);
  const agentName = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of agents.data ?? []) m.set(a.id, a.name);
    return m;
  }, [agents.data]);

  return (
    <Screen
      title="Tasks"
      scroll={false}
      headerRight={
        <IconButton onPress={() => router.push("/issues/new")}>
          <Plus size={20} color={colors.teal} />
        </IconButton>
      }
    >
      <SegmentedControl<View2>
        value={view}
        onChange={setView}
        options={[
          { value: "list", label: "List" },
          { value: "board", label: "Board" },
        ]}
      />

      {q.isLoading ? (
        <View style={styles.loading}>
          <Skeleton width="100%" height={64} radius={16} />
          <Skeleton width="100%" height={64} radius={16} />
          <Skeleton width="100%" height={64} radius={16} />
        </View>
      ) : view === "list" ? (
        <FlatList
          data={issues}
          keyExtractor={(it) => it.id}
          style={styles.flex}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={Separator}
          onEndReachedThreshold={0.5}
          onEndReached={() => q.hasNextPage && q.fetchNextPage()}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListEmptyComponent={<Text style={[text.small, styles.empty]}>No tasks yet.</Text>}
          renderItem={({ item }) => (
            <IssueRow
              issue={item}
              agentName={item.assigneeAgentId ? agentName.get(item.assigneeAgentId) : undefined}
              onPress={() => router.push(`/issues/${item.id}`)}
            />
          )}
        />
      ) : (
        <Board issues={issues} />
      )}
    </Screen>
  );
}

function Board({ issues }: { issues: Issue[] }) {
  const byStatus = useMemo(() => {
    const m = new Map<string, Issue[]>();
    for (const s of BOARD_STATUSES) m.set(s, []);
    for (const it of issues) {
      if (!m.has(it.status)) m.set(it.status, []);
      m.get(it.status)!.push(it);
    }
    return m;
  }, [issues]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.flex} contentContainerStyle={styles.board}>
      {[...byStatus.entries()].map(([status, items]) => (
        <View key={status} style={styles.column}>
          <View style={styles.columnHead}>
            <IssueStatusBadge status={status} />
            <Text style={text.mono}>{items.length}</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ gap: spacing[2] }}>
              {items.map((it) => (
                <Pressable key={it.id} onPress={() => router.push(`/issues/${it.id}`)}>
                  <GlassCard padding={12} radius={14}>
                    <View style={styles.cardHead}>
                      <PriorityIcon priority={it.priority} size={13} />
                    </View>
                    <Text style={text.smallMedium} numberOfLines={3}>
                      {it.title}
                    </Text>
                  </GlassCard>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { gap: spacing[3], marginTop: spacing[4] },
  listContent: { paddingTop: spacing[4], paddingBottom: spacing[6] },
  empty: { textAlign: "center", paddingVertical: spacing[8] },
  board: { gap: spacing[3], paddingTop: spacing[4], paddingRight: spacing[4] },
  column: { width: 230 },
  columnHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing[2] },
  cardHead: { flexDirection: "row", marginBottom: 6 },
});
