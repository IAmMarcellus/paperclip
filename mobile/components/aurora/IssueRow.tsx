/** A single issue row for lists (Tasks, Inbox, Project issues, Search results). */
import { StyleSheet, Text, View } from "react-native";

import { ListRow } from "@/components/ui/ListRow";
import { AgentChip } from "./AgentChip";
import { IssueStatusBadge } from "./StatusBadge";
import { PriorityIcon } from "./PriorityIcon";
import type { Issue } from "@/lib/api/types";
import { colors, fontFamily, spacing, text } from "@/theme";

export function issueRef(issue: Pick<Issue, "id"> & { identifier?: string | null }): string {
  return issue.identifier ?? issue.id.slice(0, 8);
}

export function IssueRow({
  issue,
  agentName,
  onPress,
}: {
  issue: Issue;
  agentName?: string | null;
  onPress: () => void;
}) {
  return (
    <ListRow
      onPress={onPress}
      leading={<PriorityIcon priority={issue.priority} />}
      trailing={<IssueStatusBadge status={issue.status} />}
    >
      <Text style={text.bodyMedium} numberOfLines={2}>
        {issue.title}
      </Text>
      <View style={styles.meta}>
        <Text style={styles.ref}>{issueRef(issue)}</Text>
        {issue.assigneeAgentId ? (
          <AgentChip agent={{ id: issue.assigneeAgentId, name: agentName }} name={agentName ?? undefined} />
        ) : null}
      </View>
    </ListRow>
  );
}

const styles = StyleSheet.create({
  meta: { flexDirection: "row", alignItems: "center", gap: spacing[2], marginTop: 3 },
  ref: { fontFamily: fontFamily.mono, fontSize: 11, color: colors.dimForeground },
});
