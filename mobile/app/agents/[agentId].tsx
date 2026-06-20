import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AgentCapsule } from "@/components/aurora/AgentCapsule";
import { AgentStatusBadge, RunStatusBadge } from "@/components/aurora/StatusBadge";
import { StatGrid } from "@/components/aurora/StatGrid";
import { AuroraBackground } from "@/components/aurora/AuroraBackground";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { ListRow } from "@/components/ui/ListRow";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAgent, useAgentActions, useAgentRuns } from "@/hooks";
import { useConnection } from "@/lib/connection";
import { formatCents, humanize, relativeTime } from "@/lib/format";
import { colors, radii, spacing, text } from "@/theme";

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

  const stats = agent
    ? [
        { value: formatCents(agent.spentMonthlyCents), label: "Spent / mo" },
        { value: formatCents(agent.budgetMonthlyCents), label: "Budget / mo" },
        { value: humanize(agent.status), label: "Status" },
        { value: humanize(agent.adapterType), label: "Adapter" },
      ]
    : [];

  return (
    <View style={styles.root}>
      <AuroraBackground />

      {/* Nav bar */}
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <IconButton onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.foregroundSoft} />
        </IconButton>
        <View style={{ flex: 1 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
      >
        {agentQ.isLoading || !agent ? (
          <Skeleton width="100%" height={120} radius={20} />
        ) : (
          <>
            {/* Hero */}
            <View style={styles.hero}>
              <AgentCapsule agent={agent} status={agent.status} width={40} height={108} />
              <View style={styles.heroText}>
                <Text style={text.displayMd} numberOfLines={2}>
                  {agent.name}
                </Text>
                <View style={styles.heroMeta}>
                  <AgentStatusBadge status={agent.status} />
                </View>
                <View style={styles.pills}>
                  <Badge label={humanize(agent.role)} tint={colors.indigo} />
                  {agent.lastHeartbeatAt ? (
                    <Badge label={`Seen ${relativeTime(String(agent.lastHeartbeatAt))}`} tint={colors.mutedForeground} />
                  ) : null}
                </View>
              </View>
            </View>

            <View style={styles.block}>
              <StatGrid items={stats} columns={2} />
            </View>

            {/* Recent runs */}
            <View style={styles.block}>
              <SectionLabel trailing={<Text style={text.mono}>{runs.length}</Text>}>
                Recent runs
              </SectionLabel>
              {runsQ.isLoading ? (
                <Skeleton width="100%" height={160} radius={20} />
              ) : runs.length === 0 ? (
                <Text style={text.small}>No runs recorded yet.</Text>
              ) : (
                <GlassCard padding={4} radius={20}>
                  <View style={{ paddingHorizontal: 12 }}>
                    {runs.map((r, i) => (
                      <View key={r.id}>
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
                        {i < runs.length - 1 ? <View style={styles.divider} /> : null}
                      </View>
                    ))}
                  </View>
                </GlassCard>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Sticky action bar */}
      {agent ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
          <GlassSurface radius={radii.pill} style={styles.footerInner}>
            <Button
              label={paused ? "Resume agent" : "Pause agent"}
              variant={paused ? "default" : "outline"}
              fullWidth
              size="lg"
              loading={pause.isPending || resume.isPending}
              onPress={() => (paused ? resume.mutate() : pause.mutate())}
            />
          </GlassSurface>
        </View>
      ) : null}
    </View>
  );
}

function IconButton({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.iconBtn}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    paddingBottom: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.white10,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: { flexDirection: "row", gap: spacing[4], alignItems: "center", marginTop: spacing[2] },
  heroText: { flex: 1, gap: 8 },
  heroMeta: { flexDirection: "row" },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  block: { marginTop: spacing[6] },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.white05 },
  footer: {
    position: "absolute",
    left: spacing[5],
    right: spacing[5],
    bottom: 0,
    paddingTop: 10,
  },
  footerInner: { padding: 6 },
});
