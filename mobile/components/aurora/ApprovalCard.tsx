/**
 * ApprovalCard — a pending action needing the operator: agent + title + context,
 * optional priority badge, and Approve / Deny buttons (Activity screen).
 */
import { StyleSheet, Text, View } from "react-native";

import { MiniCapsule } from "@/components/aurora/AgentCapsule";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { humanize } from "@/lib/format";
import { colors, priorityColor, priorityColorDefault, text } from "@/theme";

export interface ApprovalCardProps {
  agent: { id?: string | null; name?: string | null } | string;
  title: string;
  context?: string;
  priority?: string | null;
  approving?: boolean;
  denying?: boolean;
  onApprove?: () => void;
  onDeny?: () => void;
}

export function ApprovalCard({
  agent,
  title,
  context,
  priority,
  approving,
  denying,
  onApprove,
  onDeny,
}: ApprovalCardProps) {
  return (
    <GlassCard radius={18} padding={16}>
      <View style={styles.topRow}>
        <MiniCapsule agent={agent} status="active" height={30} />
        <View style={styles.copy}>
          <Text style={[text.bodyMedium, styles.title]} numberOfLines={2}>
            {title}
          </Text>
          {context ? (
            <Text style={[text.small, styles.context]} numberOfLines={1}>
              {context}
            </Text>
          ) : null}
        </View>
        {priority ? (
          <Badge
            label={humanize(priority)}
            tint={priorityColor[priority] ?? priorityColorDefault}
          />
        ) : null}
      </View>
      <View style={styles.actions}>
        <Button label="Approve" onPress={onApprove} loading={approving} fullWidth size="lg" />
        <Button label="Deny" variant="outline" onPress={onDeny} loading={denying} fullWidth size="lg" />
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  copy: { flex: 1, minWidth: 0 },
  title: { color: colors.foreground },
  context: { color: colors.dimForeground, marginTop: 2 },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
});
