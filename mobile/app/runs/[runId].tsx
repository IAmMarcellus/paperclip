import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuroraBackground } from "@/components/aurora/AuroraBackground";
import { RunStatusBadge } from "@/components/aurora/StatusBadge";
import { Button } from "@/components/ui/Button";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { Skeleton } from "@/components/ui/Skeleton";
import { isTerminal, useCancelRun, useRun, useRunEvents } from "@/hooks";
import { relativeTime } from "@/lib/format";
import type { HeartbeatRunEvent } from "@/lib/api/types";
import { colors, fontFamily, radii, spacing, text } from "@/theme";

function lineColor(e: HeartbeatRunEvent): string {
  if (e.level === "error" || e.stream === "stderr") return colors.rose;
  if (e.level === "warn") return colors.amber;
  if (e.stream === "system") return colors.dimForeground;
  return colors.foregroundSoft;
}

export default function RunScreen() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const id = String(runId);
  const insets = useSafeAreaInsets();

  const runQ = useRun(id);
  const live = !isTerminal(runQ.data?.status);
  const eventsQ = useRunEvents(id, live);
  const cancel = useCancelRun(id);

  const events = useMemo(
    () => [...(eventsQ.data ?? [])].sort((a, b) => a.seq - b.seq),
    [eventsQ.data],
  );

  return (
    <View style={styles.root}>
      <AuroraBackground />

      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <ChevronLeft size={20} color={colors.foregroundSoft} />
        </Pressable>
        <View style={styles.navTitle}>
          <Text style={text.title}>Run {id.slice(0, 8)}</Text>
          {runQ.data ? (
            <Text style={[text.mono, { color: colors.dimForeground }]}>
              {relativeTime(runQ.data.startedAt ? String(runQ.data.startedAt) : null)}
            </Text>
          ) : null}
        </View>
        {runQ.data ? <RunStatusBadge status={runQ.data.status} /> : null}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing[5],
          paddingBottom: insets.bottom + (live ? 96 : 24),
          paddingTop: spacing[2],
        }}
        showsVerticalScrollIndicator={false}
      >
        <GlassSurface radius={radii.lg} style={styles.console}>
          {eventsQ.isLoading ? (
            <Skeleton width="100%" height={200} radius={radii.lg} />
          ) : events.length === 0 ? (
            <Text style={[text.mono, styles.empty]}>
              {live ? "Waiting for output…" : "No output recorded for this run."}
            </Text>
          ) : (
            events.map((e) => (
              <Text key={e.id ?? e.seq} style={[styles.line, { color: lineColor(e) }]}>
                {e.message ?? e.eventType}
              </Text>
            ))
          )}
        </GlassSurface>
      </ScrollView>

      {live ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
          <Button
            label="Cancel run"
            variant="destructive"
            fullWidth
            size="lg"
            loading={cancel.isPending}
            onPress={() => cancel.mutate()}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingBottom: 8,
  },
  navTitle: { flex: 1 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.white10,
    alignItems: "center",
    justifyContent: "center",
  },
  console: { padding: 14, minHeight: 220 },
  line: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 2,
  },
  empty: { color: colors.dimForeground, textAlign: "center", paddingVertical: 40 },
  footer: {
    position: "absolute",
    left: spacing[5],
    right: spacing[5],
    bottom: 0,
    paddingTop: 10,
  },
});
