import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AgentChip } from "@/components/aurora/AgentChip";
import { IssueRow } from "@/components/aurora/IssueRow";
import { RunStatusBadge } from "@/components/aurora/StatusBadge";
import { ChatThread, type Message } from "@/components/chat/ChatThread";
import { Composer } from "@/components/chat/Composer";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { IconButton } from "@/components/ui/IconButton";
import { RowsCard } from "@/components/ui/RowsCard";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Skeleton } from "@/components/ui/Skeleton";
import { StickyFooter } from "@/components/StickyFooter";
import {
  useApproval,
  useApprovalComments,
  useApprovalDetailActions,
  useApprovalIssues,
} from "@/hooks";
import { humanize, relativeTime } from "@/lib/format";
import { colors, fontFamily, spacing, text } from "@/theme";

export default function ApprovalDetailScreen() {
  const { approvalId } = useLocalSearchParams<{ approvalId: string }>();
  const id = String(approvalId);
  const insets = useSafeAreaInsets();

  const approvalQ = useApproval(id);
  const commentsQ = useApprovalComments(id);
  const issuesQ = useApprovalIssues(id);
  const { approve, reject, comment } = useApprovalDetailActions(id);

  const a = approvalQ.data;
  const pending = a ? /pending|revision|requested/.test(a.status) : false;
  const description =
    (a?.description as string | undefined) ?? a?.summary ?? (a?.body as string | undefined) ?? "";

  const messages: Message[] = useMemo(
    () =>
      (commentsQ.data ?? []).map((c) => ({
        id: c.id,
        role: c.authorType === "user" ? "user" : "agent",
        authorId: c.authorAgentId,
        authorName: c.authorName ?? "Agent",
        body: c.body,
        time: relativeTime(c.createdAt),
      })),
    [commentsQ.data],
  );

  const onResolve = (m: typeof approve) =>
    m.mutate(undefined, { onSuccess: () => router.back() });

  return (
    <View style={styles.root}>
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <IconButton onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.foregroundSoft} />
        </IconButton>
        <Text style={[text.mono, styles.navRef]}>Approval</Text>
        {a ? <RunStatusBadge status={a.status} /> : null}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing[5],
          paddingTop: spacing[2],
          paddingBottom: insets.bottom + (pending ? 96 : spacing[8]),
          gap: spacing[4],
        }}
        showsVerticalScrollIndicator={false}
      >
        {approvalQ.isLoading || !a ? (
          <Skeleton width="100%" height={140} radius={20} />
        ) : (
          <>
            <GlassCard padding={16}>
              <AgentChip agent={{ id: a.agentId, name: a.agentName }} name={a.agentName ?? "Agent"} />
              <Text style={[text.displayMd, styles.title]}>{a.title ?? a.summary ?? "Approval request"}</Text>
              {description ? <Text style={[text.body, styles.desc]}>{description}</Text> : null}
              <Text style={styles.time}>{relativeTime(a.createdAt)}</Text>
            </GlassCard>

            {(issuesQ.data?.length ?? 0) > 0 ? (
              <View>
                <SectionLabel>Linked tasks</SectionLabel>
                <RowsCard
                  items={issuesQ.data!}
                  keyExtractor={(i) => i.id}
                  renderRow={(i) => <IssueRow issue={i} onPress={() => router.push(`/issues/${i.id}`)} />}
                />
              </View>
            ) : null}

            <View>
              <SectionLabel>Discussion</SectionLabel>
              <ChatThread messages={messages} />
              <View style={styles.composer}>
                <Composer
                  sending={comment.isPending}
                  placeholder="Add a comment…"
                  onSend={(t) => comment.mutate(t)}
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {pending ? (
        <StickyFooter>
          <View style={styles.actions}>
            <Button
              label="Approve"
              fullWidth
              size="lg"
              loading={approve.isPending}
              onPress={() => onResolve(approve)}
            />
            <Button
              label="Reject"
              variant="outline"
              fullWidth
              size="lg"
              loading={reject.isPending}
              onPress={() => onResolve(reject)}
            />
          </View>
        </StickyFooter>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingBottom: 8,
  },
  navRef: { flex: 1, color: colors.dimForeground },
  title: { marginTop: spacing[3] },
  desc: { marginTop: spacing[2], color: colors.foregroundSoft },
  time: { fontFamily: fontFamily.mono, fontSize: 10, color: colors.dimForeground, marginTop: spacing[3] },
  composer: { marginTop: spacing[3] },
  actions: { flexDirection: "row", gap: spacing[3] },
});
