import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "@paperclipai/shared";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApprovalCard } from "@/components/aurora/ApprovalCard";
import { issueRef } from "@/components/aurora/IssueRow";
import { IssueStatusBadge, RunStatusBadge } from "@/components/aurora/StatusBadge";
import { ChatThread, type Message } from "@/components/chat/ChatThread";
import { Composer } from "@/components/chat/Composer";
import { GlassCard } from "@/components/ui/GlassCard";
import { IconButton } from "@/components/ui/IconButton";
import { ListRow } from "@/components/ui/ListRow";
import { PropertySheet, type SheetOption } from "@/components/ui/PropertySheet";
import { RowsCard } from "@/components/ui/RowsCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  isTerminal,
  useAgents,
  useIssue,
  useIssueActions,
  useIssueActivity,
  useIssueApprovals,
  useIssueComments,
  useIssueRuns,
  useRunEvents,
} from "@/hooks";
import { useConnection } from "@/lib/connection";
import { humanize, relativeTime } from "@/lib/format";
import { mapActivity } from "@/lib/ui-map";
import { ActivityFeed } from "@/components/aurora/ActivityFeed";
import {
  brandChip,
  colors,
  fontFamily,
  issueStatusColor,
  priorityColor,
  priorityColorDefault,
  radii,
  spacing,
  text,
} from "@/theme";

type Tab = "chat" | "activity" | "props";
type SheetKind = null | "status" | "priority" | "assignee";

export default function IssueDetailScreen() {
  const { issueId } = useLocalSearchParams<{ issueId: string }>();
  const id = String(issueId);
  const insets = useSafeAreaInsets();
  const { companyId } = useConnection();

  const issueQ = useIssue(id);
  const commentsQ = useIssueComments(id);
  const runsQ = useIssueRuns(id);
  const agentsQ = useAgents(companyId ?? "");
  const { postComment, update } = useIssueActions(id);

  const [tab, setTab] = useState<Tab>("chat");
  const [sheet, setSheet] = useState<SheetKind>(null);

  const issue = issueQ.data;
  const agentName = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of agentsQ.data ?? []) m.set(a.id, a.name);
    return m;
  }, [agentsQ.data]);

  const messages: Message[] = useMemo(
    () =>
      (commentsQ.data ?? []).map((c) => ({
        id: c.id,
        role: c.authorType === "user" ? "user" : "agent",
        authorId: c.authorAgentId,
        authorName: c.authorAgentId ? agentName.get(c.authorAgentId) ?? "Agent" : "Agent",
        body: c.body,
        time: relativeTime(c.createdAt ? String(c.createdAt) : null),
      })),
    [commentsQ.data, agentName],
  );

  const activeRun = useMemo(
    () => (runsQ.data ?? []).find((r) => !isTerminal(r.status)),
    [runsQ.data],
  );

  return (
    <View style={styles.root}>
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <IconButton onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.foregroundSoft} />
        </IconButton>
        <Text style={[text.mono, styles.navRef]} numberOfLines={1}>
          {issue ? issueRef(issue) : "Issue"}
        </Text>
        {issue ? <IssueStatusBadge status={issue.status} /> : null}
      </View>

      <View style={styles.headerPad}>
        {issueQ.isLoading || !issue ? (
          <Skeleton width="80%" height={26} radius={8} />
        ) : (
          <Text style={text.displayMd} numberOfLines={3}>
            {issue.title}
          </Text>
        )}
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "chat", label: "Chat" },
            { value: "activity", label: "Activity" },
            { value: "props", label: "Details" },
          ]}
        />
      </View>

      {tab === "chat" ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={insets.top + 8}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
          >
            {commentsQ.isLoading ? (
              <Skeleton width="100%" height={120} radius={radii.lg} />
            ) : (
              <ChatThread
                messages={messages}
                footer={activeRun ? <InlineRun runId={activeRun.id} status={activeRun.status} /> : null}
              />
            )}
          </ScrollView>
          <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
            <Composer
              sending={postComment.isPending}
              placeholder="Message this task…"
              onSend={(body) => postComment.mutate({ body })}
            />
          </View>
        </KeyboardAvoidingView>
      ) : tab === "activity" ? (
        <ActivityTab id={id} />
      ) : (
        <PropsTab
          issue={issue}
          agentName={agentName}
          onEdit={setSheet}
          insetBottom={insets.bottom}
        />
      )}

      {/* Property sheets */}
      <PropertySheet
        visible={sheet === "status"}
        title="Status"
        selected={issue?.status}
        onClose={() => setSheet(null)}
        onSelect={(v) => update.mutate({ status: v })}
        options={ISSUE_STATUSES.map((s) => ({
          value: s,
          label: humanize(s),
          color: brandChip[issueStatusColor[s] ?? "gray"].text,
        }))}
      />
      <PropertySheet
        visible={sheet === "priority"}
        title="Priority"
        selected={issue?.priority}
        onClose={() => setSheet(null)}
        onSelect={(v) => update.mutate({ priority: v })}
        options={ISSUE_PRIORITIES.map((p) => ({
          value: p,
          label: humanize(p),
          color: priorityColor[p] ?? priorityColorDefault,
        }))}
      />
      <PropertySheet
        visible={sheet === "assignee"}
        title="Assignee"
        selected={issue?.assigneeAgentId ?? undefined}
        onClose={() => setSheet(null)}
        onSelect={(v) => update.mutate({ assigneeAgentId: v || null })}
        options={[
          { value: "", label: "Unassigned" },
          ...(agentsQ.data ?? []).map((a) => ({ value: a.id, label: a.name })),
        ]}
      />
    </View>
  );
}

/** Compact live-run card streaming its latest lines; taps through to the run screen. */
function InlineRun({ runId, status }: { runId: string; status: string }) {
  const eventsQ = useRunEvents(runId, !isTerminal(status));
  const lines = (eventsQ.data ?? []).slice(-5);
  return (
    <Pressable onPress={() => router.push(`/runs/${runId}`)}>
      <GlassCard accent radius={radii.lg} padding={12}>
        <View style={styles.runHead}>
          <RunStatusBadge status={status} />
          <Text style={text.mono}>tap to watch</Text>
        </View>
        {lines.map((e) => (
          <Text key={e.id ?? e.seq} style={styles.runLine} numberOfLines={1}>
            {e.message ?? e.eventType}
          </Text>
        ))}
      </GlassCard>
    </Pressable>
  );
}

function ActivityTab({ id }: { id: string }) {
  const runsQ = useIssueRuns(id);
  const approvalsQ = useIssueApprovals(id);
  const activityQ = useIssueActivity(id);
  const runs = runsQ.data ?? [];
  const approvals = approvalsQ.data ?? [];
  const feed = useMemo(() => mapActivity(activityQ.data), [activityQ.data]);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={text.label}>Runs</Text>
      {runs.length === 0 ? (
        <Text style={[text.small, styles.pad]}>No runs yet.</Text>
      ) : (
        <RowsCard
          items={runs}
          keyExtractor={(r) => r.id}
          renderRow={(r) => (
            <ListRow onPress={() => router.push(`/runs/${r.id}`)} trailing={<RunStatusBadge status={r.status} />}>
              <Text style={text.smallMedium}>Run {r.id.slice(0, 8)}</Text>
              <Text style={[text.mono, { color: colors.dimForeground }]}>
                {relativeTime(r.startedAt ?? r.createdAt)}
              </Text>
            </ListRow>
          )}
        />
      )}

      {approvals.length > 0 ? (
        <>
          <Text style={[text.label, styles.section]}>Approvals</Text>
          <View style={{ gap: spacing[3] }}>
            {approvals.map((a) => (
              <ApprovalCard
                key={a.id}
                agent={{ id: a.agentId ?? a.id, name: a.agentName ?? "Agent" }}
                title={a.title ?? a.summary ?? "Approval"}
                context={humanize(a.status)}
              />
            ))}
          </View>
        </>
      ) : null}

      <Text style={[text.label, styles.section]}>History</Text>
      <ActivityFeed items={feed} />
    </ScrollView>
  );
}

function PropsTab({
  issue,
  agentName,
  onEdit,
  insetBottom,
}: {
  issue: ReturnType<typeof useIssue>["data"];
  agentName: Map<string, string>;
  onEdit: (k: Exclude<SheetKind, null>) => void;
  insetBottom: number;
}) {
  if (!issue) return null;
  const assignee = issue.assigneeAgentId ? agentName.get(issue.assigneeAgentId) ?? "Agent" : "Unassigned";
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.tabContent, { paddingBottom: insetBottom + spacing[8] }]}
      showsVerticalScrollIndicator={false}
    >
      <RowsCard
        items={[
          { k: "status" as const, label: "Status", value: humanize(issue.status) },
          { k: "priority" as const, label: "Priority", value: humanize(issue.priority) },
          { k: "assignee" as const, label: "Assignee", value: assignee },
        ]}
        keyExtractor={(it) => it.k}
        renderRow={(it) => (
          <ListRow onPress={() => onEdit(it.k)} chevron>
            <Text style={text.small}>{it.label}</Text>
            <Text style={text.bodyMedium}>{it.value}</Text>
          </ListRow>
        )}
      />
      {issue.description ? (
        <View style={styles.section}>
          <Text style={text.label}>Description</Text>
          <GlassCard padding={16}>
            <Text style={text.body}>{issue.description}</Text>
          </GlassCard>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingBottom: 8,
  },
  navRef: { flex: 1, color: colors.dimForeground },
  headerPad: { paddingHorizontal: spacing[5], gap: spacing[4], paddingBottom: spacing[4] },
  chatContent: { paddingHorizontal: spacing[5], paddingBottom: spacing[4], paddingTop: spacing[2] },
  composer: { paddingHorizontal: spacing[4], paddingTop: 6 },
  tabContent: { paddingHorizontal: spacing[5], paddingTop: spacing[2], gap: spacing[2] },
  section: { marginTop: spacing[5], gap: spacing[2] },
  pad: { paddingVertical: spacing[3] },
  runHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  runLine: { fontFamily: fontFamily.mono, fontSize: 12, lineHeight: 17, color: colors.foregroundSoft },
});
