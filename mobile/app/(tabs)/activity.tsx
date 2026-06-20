import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ActivityFeed } from "@/components/aurora/ActivityFeed";
import { ApprovalCard } from "@/components/aurora/ApprovalCard";
import { Screen } from "@/components/Screen";
import { Badge } from "@/components/ui/Badge";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { useActivity, useApprovalActions, useApprovals } from "@/hooks";
import { useConnection } from "@/lib/connection";
import { humanize } from "@/lib/format";
import { mapActivity } from "@/lib/ui-map";
import { colors, spacing, text } from "@/theme";

type Tab = "approvals" | "stream";

export default function ActivityScreen() {
  const { companyId } = useConnection();
  const cid = companyId ?? "";
  const [tab, setTab] = useState<Tab>("approvals");

  const approvals = useApprovals(cid);
  const activity = useActivity(cid);
  const { approve, reject } = useApprovalActions(cid);

  const pending = useMemo(
    () => (approvals.data ?? []).filter((a) => /pending|revision|requested/.test(a.status)),
    [approvals.data],
  );
  const feed = useMemo(() => mapActivity(activity.data), [activity.data]);

  return (
    <Screen
      title="Activity"
      onRefresh={() => {
        approvals.refetch();
        activity.refetch();
      }}
      refreshing={approvals.isRefetching || activity.isRefetching}
    >
      <SegmentedControl<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "approvals", label: "Approvals" },
          { value: "stream", label: "Stream" },
        ]}
      />

      {tab === "approvals" ? (
        <View style={styles.block}>
          <SectionLabel
            trailing={
              pending.length ? <Badge label={`${pending.length} pending`} tint={colors.amber} /> : undefined
            }
          >
            Needs you
          </SectionLabel>
          {approvals.isLoading ? (
            <Skeleton width="100%" height={180} radius={18} />
          ) : pending.length === 0 ? (
            <Text style={text.small}>Nothing waiting on you. 🎉</Text>
          ) : (
            <View style={{ gap: spacing[3] }}>
              {pending.map((a) => (
                <ApprovalCard
                  key={a.id}
                  agent={{ id: a.agentId ?? a.id, name: a.agentName ?? "Agent" }}
                  title={a.title ?? a.summary ?? "Approval request"}
                  context={humanize(a.status)}
                  priority={a.priority}
                  approving={approve.isPending && approve.variables === a.id}
                  denying={reject.isPending && reject.variables === a.id}
                  onApprove={() => approve.mutate(a.id)}
                  onDeny={() => reject.mutate(a.id)}
                />
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.block}>
          <SectionLabel>Recent stream</SectionLabel>
          {activity.isLoading ? (
            <Skeleton width="100%" height={220} radius={20} />
          ) : (
            <ActivityFeed items={feed} />
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: spacing[5] },
});
