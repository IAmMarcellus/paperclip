import { router } from "expo-router";
import { FileText } from "lucide-react-native";
import { FlatList, Image, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/Screen";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useArtifacts } from "@/hooks";
import { apiConfig } from "@/lib/config";
import { useConnection } from "@/lib/connection";
import type { Artifact } from "@/lib/api/types";
import { colors, radii, spacing, text } from "@/theme";

function resolveUri(u?: string | null): string | null {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return `${apiConfig.baseUrl}${u.startsWith("/") ? "" : "/"}${u}`;
}

function Card({ a }: { a: Artifact }) {
  const uri = resolveUri(a.thumbnailUrl ?? a.url);
  const isImage = (a.kind ?? "").includes("image") || /\.(png|jpe?g|gif|webp)$/i.test(a.url ?? "");
  return (
    <View style={styles.cell}>
      <GlassCard padding={0} radius={radii.lg}>
        <View style={styles.thumb}>
          {uri && isImage ? (
            <Image source={{ uri }} style={styles.img} resizeMode="cover" />
          ) : (
            <FileText size={26} color={colors.mutedForeground} />
          )}
        </View>
        <Text style={[text.small, styles.title]} numberOfLines={1}>
          {a.title ?? a.name ?? a.kind ?? "Artifact"}
        </Text>
      </GlassCard>
    </View>
  );
}

export default function ArtifactsScreen() {
  const { companyId } = useConnection();
  const q = useArtifacts(companyId ?? "");
  const list = q.data ?? [];

  return (
    <Screen title="Artifacts" onBack={() => router.back()} scroll={false} bottomInset={spacing[8]}>
      {q.isLoading ? (
        <Skeleton width="100%" height={200} radius={20} />
      ) : (
        <FlatList
          data={list}
          numColumns={2}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.rowWrap}
          showsVerticalScrollIndicator={false}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListEmptyComponent={<Text style={[text.small, styles.empty]}>No artifacts yet.</Text>}
          renderItem={({ item }) => <Card a={item} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { paddingTop: spacing[4] },
  rowWrap: { gap: spacing[3], marginBottom: spacing[3] },
  cell: { flex: 1 },
  thumb: {
    height: 110,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  img: { width: "100%", height: "100%" },
  title: { padding: spacing[3] },
  empty: { textAlign: "center", paddingVertical: spacing[8] },
});
