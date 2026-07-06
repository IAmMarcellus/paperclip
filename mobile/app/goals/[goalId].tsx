import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge } from "@/components/ui/Badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { IconButton } from "@/components/ui/IconButton";
import { ListRow } from "@/components/ui/ListRow";
import { RowsCard } from "@/components/ui/RowsCard";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Skeleton } from "@/components/ui/Skeleton";
import { useGoal, useGoals } from "@/hooks";
import { useConnection } from "@/lib/connection";
import { humanize } from "@/lib/format";
import { colors, spacing, text } from "@/theme";

export default function GoalDetailScreen() {
  const { goalId } = useLocalSearchParams<{ goalId: string }>();
  const id = String(goalId);
  const insets = useSafeAreaInsets();
  const { companyId } = useConnection();
  const goalQ = useGoal(id);
  const allQ = useGoals(companyId ?? "");

  const g = goalQ.data;
  const children = useMemo(() => (allQ.data ?? []).filter((x) => x.parentId === id), [allQ.data, id]);

  return (
    <View style={styles.root}>
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <IconButton onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.foregroundSoft} />
        </IconButton>
        {g ? <Badge label={humanize(g.status)} tint={colors.amber} /> : null}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[8], gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {goalQ.isLoading || !g ? (
          <Skeleton width="100%" height={120} radius={20} />
        ) : (
          <>
            <Text style={text.displayMd}>{g.title}</Text>
            <Badge label={humanize(g.level)} tint={colors.indigo} />
            {g.description ? (
              <GlassCard padding={16}>
                <Text style={text.body}>{g.description}</Text>
              </GlassCard>
            ) : null}
            {children.length > 0 ? (
              <View>
                <SectionLabel>Sub-goals</SectionLabel>
                <RowsCard
                  items={children}
                  keyExtractor={(c) => c.id}
                  renderRow={(c) => (
                    <ListRow
                      onPress={() => router.push(`/goals/${c.id}`)}
                      trailing={<Badge label={humanize(c.status)} tint={colors.amber} />}
                    >
                      <Text style={text.bodyMedium} numberOfLines={1}>
                        {c.title}
                      </Text>
                    </ListRow>
                  )}
                />
              </View>
            ) : null}
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
});
