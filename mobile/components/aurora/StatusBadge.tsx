/**
 * Status badges built on the generic Badge + the ported status-colour maps.
 *   AgentStatusBadge — teal/emerald/gray/rose dot + label.
 *   IssueStatusBadge / RunStatusBadge — brand chip colours.
 */
import { Badge } from "@/components/ui/Badge";
import { StatusDot } from "@/components/ui/StatusDot";
import { StyleSheet, Text, View } from "react-native";

import {
  chipFor,
  fontFamily,
  getAgentStatusVisual,
  issueStatusColor,
  runStatusColor,
} from "@/theme";

export function AgentStatusBadge({ status }: { status?: string | null }) {
  const v = getAgentStatusVisual(status);
  return (
    <View style={styles.row}>
      <StatusDot color={v.color} pulse={v.animate} size={8} />
      <Text style={[styles.label, { color: v.color }]}>{v.label}</Text>
    </View>
  );
}

export function IssueStatusBadge({ status }: { status?: string | null }) {
  return <Badge label={(status ?? "—").replace(/_/g, " ")} chip={chipFor(issueStatusColor, status)} />;
}

export function RunStatusBadge({ status }: { status?: string | null }) {
  return <Badge label={(status ?? "—").replace(/_/g, " ")} chip={chipFor(runStatusColor, status)} dot />;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 7 },
  label: { fontFamily: fontFamily.sansMedium, fontSize: 13 },
});
