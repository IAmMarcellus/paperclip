import { router } from "expo-router";
import { Text } from "react-native";

import { Screen } from "@/components/Screen";
import { Badge } from "@/components/ui/Badge";
import { ListRow } from "@/components/ui/ListRow";
import { RowsCard } from "@/components/ui/RowsCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useExecutionWorkspaces } from "@/hooks";
import { useConnection } from "@/lib/connection";
import { humanize } from "@/lib/format";
import { colors, text } from "@/theme";

export default function WorkspacesScreen() {
  const { companyId } = useConnection();
  const q = useExecutionWorkspaces(companyId ?? "");
  const list = (q.data ?? []) as Array<{ id: string; name?: string | null; status?: string | null }>;

  return (
    <Screen title="Workspaces" onBack={() => router.back()} onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      {q.isLoading ? (
        <Skeleton width="100%" height={200} radius={20} />
      ) : list.length === 0 ? (
        <Text style={text.small}>No execution workspaces.</Text>
      ) : (
        <RowsCard
          items={list}
          keyExtractor={(w) => w.id}
          renderRow={(w) => (
            <ListRow
              chevron={false}
              trailing={w.status ? <Badge label={humanize(w.status)} tint={colors.emerald} /> : undefined}
            >
              <Text style={text.bodyMedium} numberOfLines={1}>
                {w.name ?? w.id.slice(0, 8)}
              </Text>
            </ListRow>
          )}
        />
      )}
      <Text style={[text.small, { marginTop: 16 }]}>
        Service controls and runtime logs are available on the web.
      </Text>
    </Screen>
  );
}
