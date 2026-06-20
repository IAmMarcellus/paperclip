import { router } from "expo-router";
import { Text, View } from "react-native";

import { StatGrid } from "@/components/aurora/StatGrid";
import { Screen } from "@/components/Screen";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCostsSummary } from "@/hooks";
import { useConnection } from "@/lib/connection";
import { formatCents } from "@/lib/format";
import { colors, spacing, text } from "@/theme";

export default function CostsScreen() {
  const { companyId } = useConnection();
  const q = useCostsSummary(companyId ?? "");
  const c = q.data;
  const util = c ? Math.max(0, Math.min(1, c.utilizationPercent / 100)) : 0;

  return (
    <Screen title="Costs" onBack={() => router.back()} onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      {q.isLoading || !c ? (
        <Skeleton width="100%" height={120} radius={20} />
      ) : (
        <>
          <StatGrid
            columns={2}
            items={[
              { value: formatCents(c.spendCents), label: "Spent / mo", tint: colors.teal },
              { value: formatCents(c.budgetCents), label: "Budget / mo" },
            ]}
          />
          <View style={{ marginTop: spacing[4] }}>
            <SectionLabel
              trailing={<Text style={text.mono}>{Math.round(c.utilizationPercent)}%</Text>}
            >
              Budget used
            </SectionLabel>
            <GlassCard padding={16}>
              <ProgressBar value={util} height={10} />
              <Text style={[text.small, { marginTop: 10 }]}>
                {formatCents(c.spendCents)} of {formatCents(c.budgetCents)} this month
              </Text>
            </GlassCard>
          </View>
          <Text style={[text.small, { marginTop: spacing[4] }]}>
            Per-agent and per-provider breakdowns are available on the web.
          </Text>
        </>
      )}
    </Screen>
  );
}
