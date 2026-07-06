import { router } from "expo-router";
import { Plus } from "lucide-react-native";
import { Text } from "react-native";

import { Screen } from "@/components/Screen";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { ListRow } from "@/components/ui/ListRow";
import { RowsCard } from "@/components/ui/RowsCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useProjects } from "@/hooks";
import { useConnection } from "@/lib/connection";
import { humanize } from "@/lib/format";
import { colors, text } from "@/theme";

export default function ProjectsScreen() {
  const { companyId } = useConnection();
  const q = useProjects(companyId ?? "");
  const list = q.data ?? [];

  return (
    <Screen
      title="Projects"
      onBack={() => router.back()}
      headerRight={
        <IconButton onPress={() => router.push("/projects/new")}>
          <Plus size={20} color={colors.teal} />
        </IconButton>
      }
      onRefresh={() => q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isLoading ? (
        <Skeleton width="100%" height={200} radius={20} />
      ) : list.length === 0 ? (
        <Text style={text.small}>No projects yet.</Text>
      ) : (
        <RowsCard
          items={list}
          keyExtractor={(p) => p.id}
          renderRow={(p) => (
            <ListRow
              onPress={() => router.push(`/projects/${p.id}`)}
              trailing={<Badge label={humanize(p.status)} tint={colors.indigo} />}
            >
              <Text style={text.bodyMedium} numberOfLines={1}>
                {p.name}
              </Text>
              <Text style={text.small} numberOfLines={1}>
                {p.taskCount != null ? `${p.taskCount} tasks` : (p.description ?? "")}
              </Text>
            </ListRow>
          )}
        />
      )}
    </Screen>
  );
}
