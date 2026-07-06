import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ActivityFeed } from "@/components/aurora/ActivityFeed";
import { ApprovalCard } from "@/components/aurora/ApprovalCard";
import { Screen } from "@/components/Screen";
import { Badge } from "@/components/ui/Badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusDot } from "@/components/ui/StatusDot";
import { useActivity, useApprovalActions, useApprovals } from "@/hooks";
import { useConnection } from "@/lib/connection";
import { humanize, relativeTime } from "@/lib/format";
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
      header={
        <View style={styles.screenHeader}>
          <Text style={text.displayLg}>Activity</Text>
          <Text style={[text.small, styles.headerMeta]}>
            Approvals and live operating stream
          </Text>
        </View>
      }
      onRefresh={() => Promise.all([approvals.refetch(), activity.refetch()])}
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
            <EmptyCard message="Nothing waiting on you." />
          ) : (
            <View style={styles.approvalList}>
              {pending.map((a) => (
                <ApprovalCard
                  key={a.id}
                  agent={{ id: a.agentId ?? a.id, name: a.agentName ?? "Agent" }}
                  title={a.title ?? a.summary ?? "Approval request"}
                  context={[a.agentName ?? "Agent", humanize(a.status), relativeTime(a.createdAt)]
                    .filter(Boolean)
                    .join(" · ")}
                  priority={a.priority}
                  approving={approve.isPending && approve.variables === a.id}
                  denying={reject.isPending && reject.variables === a.id}
                  onApprove={() => approve.mutate(a.id)}
                  onDeny={() => reject.mutate(a.id)}
                />
              ))}
            </View>
          )}
          <View style={styles.streamPreview}>
            <SectionLabel
              trailing={
                <View style={styles.liveTrail}>
                  <StatusDot color={colors.emerald} size={6} pulse />
                  <Text style={[text.label, styles.liveText]}>live</Text>
                </View>
              }
            >
              Recent stream
            </SectionLabel>
            {activity.isLoading ? (
              <Skeleton width="100%" height={120} radius={20} />
            ) : (
              <ActivityFeed items={feed.slice(0, 5)} />
            )}
          </View>
        </View>
      ) : (
        <View style={styles.block}>
          <SectionLabel
            trailing={
              <View style={styles.liveTrail}>
                <StatusDot color={colors.emerald} size={6} pulse />
                <Text style={[text.label, styles.liveText]}>live</Text>
              </View>
            }
          >
            Recent stream
          </SectionLabel>
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

function EmptyCard({ message }: { message: string }) {
  return (
    <GlassCard padding={18} radius={20}>
      <Text style={[text.small, styles.empty]}>{message}</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  screenHeader: { marginBottom: spacing[4] },
  headerMeta: { color: colors.dimForeground, marginTop: 3 },
  block: { marginTop: spacing[5] },
  approvalList: { gap: spacing[3] },
  streamPreview: { marginTop: spacing[6] },
  liveTrail: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveText: { color: colors.emerald },
  empty: { color: colors.dimForeground, textAlign: "center" },
});
