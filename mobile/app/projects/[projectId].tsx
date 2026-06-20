import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IssueRow } from "@/components/aurora/IssueRow";
import { Badge } from "@/components/ui/Badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { IconButton } from "@/components/ui/IconButton";
import { RowsCard } from "@/components/ui/RowsCard";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { ChevronLeft } from "lucide-react-native";
import { useProject, useProjectIssues } from "@/hooks";
import { useConnection } from "@/lib/connection";
import { formatCents, humanize } from "@/lib/format";
import { colors, spacing, text } from "@/theme";

type Tab = "overview" | "issues";

export default function ProjectDetailScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const id = String(projectId);
  const insets = useSafeAreaInsets();
  const { companyId } = useConnection();
  const projectQ = useProject(id);
  const issuesQ = useProjectIssues(companyId ?? "", id);
  const [tab, setTab] = useState<Tab>("overview");

  const p = projectQ.data;
  const budget = (p as { budget?: { monthlyLimitCents?: number } } | undefined)?.budget;

  return (
    <View style={styles.root}>
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <IconButton onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.foregroundSoft} />
        </IconButton>
        {p ? <Badge label={humanize(p.status)} tint={colors.indigo} /> : null}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[8], gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {projectQ.isLoading || !p ? (
          <Skeleton width="100%" height={120} radius={20} />
        ) : (
          <>
            <Text style={text.displayMd}>{p.name}</Text>
            <SegmentedControl<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: "overview", label: "Overview" },
                { value: "issues", label: "Tasks" },
              ]}
            />

            {tab === "overview" ? (
              <View style={{ gap: spacing[4] }}>
                {p.description ? (
                  <GlassCard padding={16}>
                    <Text style={text.body}>{p.description}</Text>
                  </GlassCard>
                ) : null}
                <RowsCard
                  items={[
                    { k: "tasks", label: "Tasks", value: String(p.taskCount ?? issuesQ.data?.length ?? 0) },
                    { k: "target", label: "Target date", value: p.targetDate ? String(p.targetDate).slice(0, 10) : "—" },
                    { k: "budget", label: "Budget / mo", value: budget?.monthlyLimitCents != null ? formatCents(budget.monthlyLimitCents) : "—" },
                  ]}
                  keyExtractor={(it) => it.k}
                  renderRow={(it) => (
                    <View style={styles.statRow}>
                      <Text style={text.small}>{it.label}</Text>
                      <Text style={text.bodyMedium}>{it.value}</Text>
                    </View>
                  )}
                />
              </View>
            ) : issuesQ.isLoading ? (
              <Skeleton width="100%" height={200} radius={20} />
            ) : (issuesQ.data?.length ?? 0) === 0 ? (
              <Text style={text.small}>No tasks in this project.</Text>
            ) : (
              <>
                <SectionLabel>Tasks</SectionLabel>
                <RowsCard
                  items={issuesQ.data!}
                  keyExtractor={(i) => i.id}
                  renderRow={(i) => <IssueRow issue={i} onPress={() => router.push(`/issues/${i.id}`)} />}
                />
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingBottom: 8,
  },
  statRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
});
