import { router } from "expo-router";
import { Plus } from "lucide-react-native";
import { Text } from "react-native";

import { Screen } from "@/components/Screen";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { ListRow } from "@/components/ui/ListRow";
import { RowsCard } from "@/components/ui/RowsCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useGoals } from "@/hooks";
import { useConnection } from "@/lib/connection";
import { humanize } from "@/lib/format";
import { colors, text } from "@/theme";

export default function GoalsScreen() {
  const { companyId } = useConnection();
  const q = useGoals(companyId ?? "");
  const list = q.data ?? [];

  return (
    <Screen
      title="Goals"
      onBack={() => router.back()}
      headerRight={
        <IconButton onPress={() => router.push("/goals/new")}>
          <Plus size={20} color={colors.teal} />
        </IconButton>
      }
      onRefresh={() => q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isLoading ? (
        <Skeleton width="100%" height={200} radius={20} />
      ) : list.length === 0 ? (
        <Text style={text.small}>No goals yet.</Text>
      ) : (
        <RowsCard
          items={list}
          keyExtractor={(g) => g.id}
          renderRow={(g) => (
            <ListRow
              onPress={() => router.push(`/goals/${g.id}`)}
              trailing={<Badge label={humanize(g.status)} tint={colors.amber} />}
            >
              <Text style={text.bodyMedium} numberOfLines={1}>
                {g.title}
              </Text>
              <Text style={text.small} numberOfLines={1}>
                {humanize(g.level)}
              </Text>
            </ListRow>
          )}
        />
      )}
    </Screen>
  );
}
