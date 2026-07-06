import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, MessageSquare, Pause, Play, SlidersHorizontal } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AgentCapsule } from "@/components/aurora/AgentCapsule";
import { AuroraBackground } from "@/components/aurora/AuroraBackground";
import { RunStatusBadge } from "@/components/aurora/StatusBadge";
import { StatGrid } from "@/components/aurora/StatGrid";
import { StickyFooter } from "@/components/StickyFooter";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { IconButton } from "@/components/ui/IconButton";
import { ListRow } from "@/components/ui/ListRow";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { RowsCard } from "@/components/ui/RowsCard";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusDot } from "@/components/ui/StatusDot";
import { isTerminal, useAgent, useAgentActions, useAgentRuns } from "@/hooks";
import { useConnection } from "@/lib/connection";
import { humanize, relativeTime } from "@/lib/format";
import { agentDetailStats, agentDisplayRole, agentModelLabel, agentTaskText } from "@/lib/ui-map";
import { colors, getAgentStatusVisual, spacing, text } from "@/theme";

function runProgress(status?: string | null): number {
  if (!status) return 0;
  if (isTerminal(status)) return 1;
  if (status === "queued" || status === "pending") return 0.18;
  return 0.6;
}

export default function AgentDetailScreen() {
  const { agentId } = useLocalSearchParams<{ agentId: string }>();
  const id = String(agentId);
  const insets = useSafeAreaInsets();
  const { companyId } = useConnection();
  const agentQ = useAgent(id);
  const runsQ = useAgentRuns(companyId ?? "", id);
  const { pause, resume } = useAgentActions(id);

  const agent = agentQ.data;
  const paused = agent?.status === "paused";
  const runs = runsQ.data ?? [];
  const currentRun = runs.find((r) => !isTerminal(r.status)) ?? runs[0];

  const stats = agent ? agentDetailStats(agent, runs) : [];
  const statusVisual = agent ? getAgentStatusVisual(agent.status) : null;
  const currentTask = agent ? agentTaskText(agent, currentRun) : "";

  return (
    <View style={styles.root}>
      <AuroraBackground />
      {/* Nav bar */}
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <IconButton onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.foregroundSoft} />
        </IconButton>
        <IconButton onPress={() => router.push("/settings")}>
          <SlidersHorizontal size={19} color={colors.foregroundSoft} />
        </IconButton>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentInset={{ bottom: insets.bottom + 96 }}
        scrollIndicatorInsets={{ bottom: insets.bottom + 96 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: spacing[6] }}
        showsVerticalScrollIndicator={false}
      >
        {agentQ.isLoading || !agent ? (
          <Skeleton width="100%" height={120} radius={20} />
        ) : (
          <>
            {/* Hero */}
            <View style={styles.hero}>
              <AgentCapsule agent={agent} status={agent.status} width={40} height={116} />
              <View style={styles.heroText}>
                <View style={styles.nameRow}>
                  <StatusDot
                    color={statusVisual?.color ?? colors.statusIdle}
                    size={9}
                    pulse={statusVisual?.animate}
                  />
                  <Text style={text.displayLg} numberOfLines={1}>
                    {agent.name}
                  </Text>
                </View>
                <Text style={text.small} numberOfLines={1}>
                  {agentDisplayRole(agent)}
                </Text>
                <View style={styles.pills}>
                  <Badge
                    label={agent.status === "running" ? "Working now" : statusVisual?.label ?? humanize(agent.status)}
                    tint={statusVisual?.color ?? colors.statusIdle}
                  />
                  <Badge label={agentModelLabel(agent)} tint={colors.indigo} />
                  {agent.lastHeartbeatAt ? (
                    <Badge label={`Seen ${relativeTime(String(agent.lastHeartbeatAt))}`} tint={colors.mutedForeground} />
                  ) : null}
                </View>
              </View>
            </View>

            <View style={styles.block}>
              <GlassCard padding={16} radius={18}>
                <Text style={text.label}>Current task</Text>
                <Text style={[text.bodyMedium, styles.taskTitle]} numberOfLines={2}>
                  {currentTask || "No active run recorded"}
                </Text>
                <View style={styles.progressRow}>
                  <ProgressBar value={runProgress(currentRun?.status)} height={6} style={styles.progress} />
                  <Text style={text.mono}>{Math.round(runProgress(currentRun?.status) * 100)}%</Text>
                </View>
              </GlassCard>
            </View>

            <View style={styles.block}>
              <StatGrid items={stats} columns={2} />
            </View>

            {/* Recent runs */}
            <View style={styles.block}>
              <SectionLabel trailing={<Text style={text.mono}>{runs.length}</Text>}>
                Recent actions
              </SectionLabel>
              {runsQ.isLoading ? (
                <Skeleton width="100%" height={160} radius={20} />
              ) : runs.length === 0 ? (
                <Text style={text.small}>No runs recorded yet.</Text>
              ) : (
                <RowsCard
                  items={runs.slice(0, 5)}
                  keyExtractor={(r) => r.id}
                  renderRow={(r) => (
                    <ListRow
                      onPress={() => router.push(`/runs/${r.id}`)}
                      trailing={<RunStatusBadge status={r.status} />}
                    >
                      <Text style={text.smallMedium} numberOfLines={1}>
                        Run {r.id.slice(0, 8)}
                      </Text>
                      <Text style={[text.mono, { color: colors.dimForeground }]}>
                        {relativeTime(r.startedAt ?? r.createdAt)}
                      </Text>
                    </ListRow>
                  )}
                />
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Sticky action bar */}
      {agent ? (
        <StickyFooter>
          <GlassSurface radius={18} style={styles.footerInner}>
            <Button
              label="Message"
              icon={<MessageSquare size={17} color={colors.primaryForeground} />}
              fullWidth
              size="lg"
              onPress={() => router.push("/board-chat")}
            />
            <Pressable
              onPress={() => (paused ? resume.mutate() : pause.mutate())}
              disabled={pause.isPending || resume.isPending}
              style={({ pressed }) => [
                styles.actionIcon,
                (pressed || pause.isPending || resume.isPending) ? styles.pressed : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={paused ? "Resume agent" : "Pause agent"}
            >
              {paused ? (
                <Play size={18} color={colors.foregroundSoft} />
              ) : (
                <Pause size={18} color={colors.foregroundSoft} />
              )}
            </Pressable>
          </GlassSurface>
        </StickyFooter>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.transparent },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingBottom: 8,
  },
  hero: { flexDirection: "row", gap: spacing[5], alignItems: "center", marginTop: spacing[2] },
  heroText: { flex: 1, gap: 8 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  block: { marginTop: spacing[6] },
  taskTitle: { marginTop: 9 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  progress: { flex: 1 },
  footerInner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 6 },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.white10,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
});
