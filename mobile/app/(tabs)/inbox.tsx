import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ApprovalCard } from "@/components/aurora/ApprovalCard";
import { IssueRow } from "@/components/aurora/IssueRow";
import { Screen } from "@/components/Screen";
import { RowsCard } from "@/components/ui/RowsCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useAgents, useApprovalActions, useApprovals, useIssues } from "@/hooks";
import { useConnection } from "@/lib/connection";
import { humanize } from "@/lib/format";
import type { Issue } from "@/lib/api/types";
import { spacing, text } from "@/theme";

type Tab = "needs" | "mine" | "blocked";

export default function InboxScreen() {
  const { companyId, user } = useConnection();
  const cid = companyId ?? "";
  const [tab, setTab] = useState<Tab>("needs");

  const approvals = useApprovals(cid);
  const issues = useIssues(cid);
  const agents = useAgents(cid);
  const { approve, reject } = useApprovalActions(cid);
  const userId = user?.id;

  const agentName = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of agents.data ?? []) m.set(a.id, a.name);
    return m;
  }, [agents.data]);

  const pending = useMemo(
    () => (approvals.data ?? []).filter((a) => /pending|revision|requested/.test(a.status)),
    [approvals.data],
  );
  const mine = useMemo(
    () => (userId ? (issues.data ?? []).filter((i) => i.assigneeUserId === userId) : []),
    [issues.data, userId],
  );
  const blocked = useMemo(
    () => (issues.data ?? []).filter((i) => i.status === "blocked"),
    [issues.data],
  );

  const issueList = (list: Issue[], emptyText: string) =>
    issues.isLoading ? (
      <Skeleton width="100%" height={200} radius={20} />
    ) : list.length === 0 ? (
      <Text style={[text.small, styles.empty]}>{emptyText}</Text>
    ) : (
      <RowsCard
        items={list}
        keyExtractor={(i) => i.id}
        renderRow={(i) => (
          <IssueRow
            issue={i}
            agentName={i.assigneeAgentId ? agentName.get(i.assigneeAgentId) : undefined}
            onPress={() => router.push(`/issues/${i.id}`)}
          />
        )}
      />
    );

  return (
    <Screen
      title="Inbox"
      onRefresh={() => {
        approvals.refetch();
        issues.refetch();
      }}
      refreshing={approvals.isRefetching || issues.isRefetching}
    >
      <SegmentedControl<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "needs", label: "Needs you" },
          { value: "mine", label: "Mine" },
          { value: "blocked", label: "Blocked" },
        ]}
      />

      <View style={styles.block}>
        {tab === "needs" ? (
          approvals.isLoading ? (
            <Skeleton width="100%" height={180} radius={18} />
          ) : pending.length === 0 ? (
            <Text style={[text.small, styles.empty]}>Nothing waiting on you. 🎉</Text>
          ) : (
            <View style={{ gap: spacing[3] }}>
              {pending.map((a) => (
                <Pressable key={a.id} onPress={() => router.push(`/approvals/${a.id}`)}>
                  <ApprovalCard
                    agent={{ id: a.agentId ?? a.id, name: a.agentName ?? "Agent" }}
                    title={a.title ?? a.summary ?? "Approval request"}
                    context={humanize(a.status)}
                    priority={a.priority}
                    approving={approve.isPending && approve.variables === a.id}
                    denying={reject.isPending && reject.variables === a.id}
                    onApprove={() => approve.mutate(a.id)}
                    onDeny={() => reject.mutate(a.id)}
                  />
                </Pressable>
              ))}
            </View>
          )
        ) : tab === "mine" ? (
          issueList(mine, userId ? "Nothing assigned to you." : "Connect with an account to see your tasks.")
        ) : (
          issueList(blocked, "No blocked tasks.")
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: spacing[5] },
  empty: { textAlign: "center", paddingVertical: spacing[8] },
});
