import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RunStatusBadge } from "@/components/aurora/StatusBadge";
import { StickyFooter } from "@/components/StickyFooter";
import { Button } from "@/components/ui/Button";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { IconButton } from "@/components/ui/IconButton";
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
  const live = useMemo(() => !isTerminal(runQ.data?.status), [runQ.data?.status]);
  const eventsQ = useRunEvents(id, live);
  const cancel = useCancelRun(id);

  const events = useMemo(
    () => [...(eventsQ.data ?? [])].sort((a, b) => a.seq - b.seq),
    [eventsQ.data],
  );

  return (
    <View style={styles.root}>
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <IconButton onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.foregroundSoft} />
        </IconButton>
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
        <StickyFooter>
          <Button
            label="Cancel run"
            variant="destructive"
            fullWidth
            size="lg"
            loading={cancel.isPending}
            onPress={() => cancel.mutate()}
          />
        </StickyFooter>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingBottom: 8,
  },
  navTitle: { flex: 1 },
  console: { padding: 14, minHeight: 220 },
  line: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 2,
  },
  empty: { color: colors.dimForeground, textAlign: "center", paddingVertical: 40 },
});
