import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/Screen";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { RowsCard } from "@/components/ui/RowsCard";
import { useSearch } from "@/hooks";
import { useConnection } from "@/lib/connection";
import { humanize } from "@/lib/format";
import { colors, spacing, text } from "@/theme";

interface Hit {
  id: string;
  type: string;
  title: string;
}

/** The search endpoint may return an array, {results}, or a grouped object. */
function normalize(data: unknown): Hit[] {
  const out: Hit[] = [];
  const push = (type: string, rows: unknown) => {
    if (!Array.isArray(rows)) return;
    for (const r of rows as Record<string, unknown>[]) {
      const id = String(r.id ?? r.issueId ?? r.agentId ?? "");
      if (!id) continue;
      out.push({
        id,
        type: String(r.type ?? r.kind ?? type),
        title: String(r.title ?? r.name ?? r.snippet ?? id),
      });
    }
  };
  if (Array.isArray(data)) push("result", data);
  else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.results)) push("result", obj.results);
    else for (const [k, v] of Object.entries(obj)) push(k.replace(/s$/, ""), v);
  }
  return out;
}

function routeFor(hit: Hit): string | null {
  const t = hit.type.toLowerCase();
  if (t.includes("issue") || t.includes("task")) return `/issues/${hit.id}`;
  if (t.includes("project")) return `/projects/${hit.id}`;
  if (t.includes("agent")) return `/agents/${hit.id}`;
  if (t.includes("goal")) return `/goals/${hit.id}`;
  return null;
}

export default function SearchScreen() {
  const { companyId } = useConnection();
  const [q, setQ] = useState("");
  const search = useSearch(companyId ?? "", q);
  const hits = useMemo(() => normalize(search.data), [search.data]);

  return (
    <Screen title="Search" onBack={() => router.back()} scroll={false} bottomInset={spacing[8]}>
      <Input value={q} onChangeText={setQ} placeholder="Search tasks, agents, projects…" autoFocus autoCorrect={false} />
      <View style={styles.results}>
        {q.trim().length <= 1 ? (
          <Text style={[text.small, styles.hint]}>Type to search across your company.</Text>
        ) : search.isFetching ? (
          <ActivityIndicator color={colors.teal} style={styles.hint} />
        ) : hits.length === 0 ? (
          <Text style={[text.small, styles.hint]}>No results.</Text>
        ) : (
          <RowsCard
            items={hits}
            keyExtractor={(h) => `${h.type}:${h.id}`}
            renderRow={(h) => {
              const route = routeFor(h);
              return (
                <ListRow
                  chevron={!!route}
                  onPress={route ? () => router.push(route) : undefined}
                  trailing={<Badge label={humanize(h.type)} tint={colors.indigo} />}
                >
                  <Text style={text.bodyMedium} numberOfLines={2}>
                    {h.title}
                  </Text>
                </ListRow>
              );
            }}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  results: { marginTop: spacing[4], flex: 1 },
  hint: { textAlign: "center", paddingVertical: spacing[8] },
});
