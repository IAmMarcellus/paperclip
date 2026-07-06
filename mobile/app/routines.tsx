import { router } from "expo-router";
import { Alert, Text, View } from "react-native";

import { AgentChip } from "@/components/aurora/AgentChip";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { ListRow } from "@/components/ui/ListRow";
import { RowsCard } from "@/components/ui/RowsCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useRoutines, useRunRoutine } from "@/hooks";
import { useConnection } from "@/lib/connection";
import { spacing, text } from "@/theme";

export default function RoutinesScreen() {
  const { companyId } = useConnection();
  const q = useRoutines(companyId ?? "");
  const run = useRunRoutine();
  const list = q.data ?? [];

  const onRun = (id: string, title: string) =>
    run.mutate(id, {
      onSuccess: () => Alert.alert("Routine started", `“${title}” was enqueued.`),
      onError: (e) => Alert.alert("Couldn't run", (e as Error).message),
    });

  return (
    <Screen title="Routines" onBack={() => router.back()} onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      {q.isLoading ? (
        <Skeleton width="100%" height={200} radius={20} />
      ) : list.length === 0 ? (
        <Text style={text.small}>No routines yet.</Text>
      ) : (
        <RowsCard
          items={list}
          keyExtractor={(r) => r.id}
          renderRow={(r) => (
            <ListRow
              chevron={false}
              trailing={
                <Button
                  label="Run"
                  size="sm"
                  variant="outline"
                  loading={run.isPending && run.variables === r.id}
                  onPress={() => onRun(r.id, r.title)}
                />
              }
            >
              <Text style={text.bodyMedium} numberOfLines={1}>
                {r.title}
              </Text>
              <View style={{ marginTop: 3 }}>
                {r.assigneeAgentId ? (
                  <AgentChip agent={{ id: r.assigneeAgentId }} name={r.assigneeAgentId.slice(0, 6)} />
                ) : (
                  <Text style={text.small}>Unassigned</Text>
                )}
              </View>
            </ListRow>
          )}
        />
      )}
      <Text style={[text.small, { marginTop: spacing[4] }]}>
        Editing routine triggers and variables is available on the web.
      </Text>
    </Screen>
  );
}
