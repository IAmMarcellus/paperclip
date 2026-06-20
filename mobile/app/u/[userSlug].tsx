import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";

import { StatGrid, type StatItem } from "@/components/aurora/StatGrid";
import { Screen } from "@/components/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { useUserProfile } from "@/hooks";
import { useConnection } from "@/lib/connection";
import { formatCents, humanize } from "@/lib/format";
import { Text } from "react-native";
import { text } from "@/theme";

/** Build up to 6 stat tiles from the profile's numeric fields (shape varies). */
function tiles(profile: Record<string, unknown> | undefined): StatItem[] {
  if (!profile) return [];
  const out: StatItem[] = [];
  for (const [k, v] of Object.entries(profile)) {
    if (typeof v !== "number") continue;
    const isCents = /cents?$/i.test(k);
    out.push({ value: isCents ? formatCents(v) : String(v), label: humanize(k.replace(/cents?$/i, "")) });
    if (out.length >= 6) break;
  }
  return out;
}

export default function UserProfileScreen() {
  const { userSlug } = useLocalSearchParams<{ userSlug: string }>();
  const slug = String(userSlug);
  const { companyId } = useConnection();
  const q = useUserProfile(companyId ?? "", slug);

  const name = (q.data?.name as string | undefined) ?? slug;
  const items = useMemo(() => tiles(q.data), [q.data]);

  return (
    <Screen title={name} eyebrow="Profile" onBack={() => router.back()} onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      {q.isLoading ? (
        <Skeleton width="100%" height={120} radius={16} />
      ) : items.length > 0 ? (
        <StatGrid items={items} columns={2} />
      ) : (
        <Text style={text.small}>No stats available.</Text>
      )}
    </Screen>
  );
}
