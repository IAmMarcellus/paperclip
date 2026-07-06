import { ISSUE_STATUSES } from "@paperclipai/shared";
import { router } from "expo-router";
import { ChevronDown, Plus, Search, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { withAlpha } from "@/components/ui/Badge";
import { IssueRow } from "@/components/aurora/IssueRow";
import { IssueStatusBadge } from "@/components/aurora/StatusBadge";
import { PriorityIcon } from "@/components/aurora/PriorityIcon";
import { Screen } from "@/components/Screen";
import { GlassCard } from "@/components/ui/GlassCard";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { PropertySheet } from "@/components/ui/PropertySheet";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Separator } from "@/components/ui/Separator";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAgents, useIssuesInfinite, useProjects } from "@/hooks";
import { useConnection } from "@/lib/connection";
import { humanize } from "@/lib/format";
import type { Issue } from "@/lib/api/types";
import { chipFor, colors, issueStatusColor, radii, spacing, text } from "@/theme";

type View2 = "list" | "board";
type SortDir = "asc" | "desc";
type SheetKind = null | "status" | "assignee" | "project" | "sort";
const BOARD_STATUSES = ["todo", "in_progress", "in_review", "blocked", "done"];

export default function TasksScreen() {
  const { companyId } = useConnection();
  const cid = companyId ?? "";
  const agents = useAgents(cid);
  const projects = useProjects(cid);

  const [view, setView] = useState<View2>("list");
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [statusSel, setStatusSel] = useState<string[]>([]);
  const [assigneeSel, setAssigneeSel] = useState(""); // "" = anyone, "null" = unassigned, else agentId
  const [projectSel, setProjectSel] = useState(""); // "" = all projects
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [sheet, setSheet] = useState<SheetKind>(null);

  // Debounce the search box so we don't refetch on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const filters = useMemo(() => {
    const f: Record<string, string | number> = {};
    if (statusSel.length) f.status = statusSel.join(","); // server accepts comma-joined statuses
    if (assigneeSel) f.assigneeAgentId = assigneeSel; // a UUID, or the literal "null" for Unassigned
    if (projectSel) f.projectId = projectSel;
    const t = debouncedQ.trim();
    if (t) f.q = t;
    if (sortDir !== "desc") f.sortDir = sortDir;
    return f;
  }, [statusSel, assigneeSel, projectSel, debouncedQ, sortDir]);

  const q = useIssuesInfinite(cid, filters);
  const issues = useMemo(() => (q.data?.pages ?? []).flat(), [q.data]);

  const agentName = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of agents.data ?? []) m.set(a.id, a.name);
    return m;
  }, [agents.data]);
  const projectName = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects.data ?? []) m.set(p.id, p.name);
    return m;
  }, [projects.data]);

  const assigneeLabel =
    assigneeSel === "" ? "Assignee" : assigneeSel === "null" ? "Unassigned" : agentName.get(assigneeSel) ?? "Assignee";
  const projectLabel = projectSel === "" ? "Project" : projectName.get(projectSel) ?? "Project";
  const hasFilters =
    statusSel.length > 0 || assigneeSel !== "" || projectSel !== "" || sortDir !== "desc" || query.trim() !== "";

  const clearAll = () => {
    setStatusSel([]);
    setAssigneeSel("");
    setProjectSel("");
    setSortDir("desc");
    setQuery("");
  };

  const toggleStatus = (s: string) =>
    setStatusSel((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  return (
    <Screen
      title="Tasks"
      scroll={false}
      headerRight={
        <IconButton onPress={() => router.push("/issues/new")}>
          <Plus size={20} color={colors.teal} />
        </IconButton>
      }
    >
      <View style={styles.controls}>
        <SegmentedControl<View2>
          value={view}
          onChange={setView}
          options={[
            { value: "list", label: "List" },
            { value: "board", label: "Board" },
          ]}
        />

        <View style={styles.search}>
          <Search size={16} color={colors.dimForeground} style={styles.searchIcon} />
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search tasks…"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.searchInput}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} style={styles.searchClear} hitSlop={8}>
              <X size={15} color={colors.dimForeground} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <FilterChip label={statusSel.length ? `Status · ${statusSel.length}` : "Status"} active={statusSel.length > 0} onPress={() => setSheet("status")} />
          <FilterChip label={assigneeLabel} active={assigneeSel !== ""} onPress={() => setSheet("assignee")} />
          <FilterChip label={projectLabel} active={projectSel !== ""} onPress={() => setSheet("project")} />
          <FilterChip label={sortDir === "asc" ? "Oldest" : "Newest"} active={sortDir === "asc"} onPress={() => setSheet("sort")} />
          {hasFilters ? (
            <Pressable onPress={clearAll} style={styles.clear} hitSlop={6}>
              <X size={13} color={colors.dimForeground} />
              <Text style={[text.smallMedium, styles.clearLabel]}>Clear</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>

      {q.isLoading ? (
        <View style={styles.loading}>
          <Skeleton width="100%" height={64} radius={16} />
          <Skeleton width="100%" height={64} radius={16} />
          <Skeleton width="100%" height={64} radius={16} />
        </View>
      ) : view === "list" ? (
        <FlatList
          data={issues}
          keyExtractor={(it) => it.id}
          style={styles.flex}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={Separator}
          onEndReachedThreshold={0.5}
          onEndReached={() => q.hasNextPage && q.fetchNextPage()}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListEmptyComponent={
            <Text style={[text.small, styles.empty]}>{hasFilters ? "No tasks match your filters." : "No tasks yet."}</Text>
          }
          renderItem={({ item }) => (
            <IssueRow
              issue={item}
              agentName={item.assigneeAgentId ? agentName.get(item.assigneeAgentId) : undefined}
              onPress={() => router.push(`/issues/${item.id}`)}
            />
          )}
        />
      ) : (
        <Board issues={issues} />
      )}

      {/* Filter sheets */}
      <PropertySheet
        visible={sheet === "status"}
        title="Filter by status"
        multiple
        values={statusSel}
        onToggle={toggleStatus}
        onClose={() => setSheet(null)}
        options={ISSUE_STATUSES.map((s) => ({
          value: s,
          label: humanize(s),
          color: chipFor(issueStatusColor, s).text,
        }))}
      />
      <PropertySheet
        visible={sheet === "assignee"}
        title="Filter by assignee"
        selected={assigneeSel}
        onSelect={setAssigneeSel}
        onClose={() => setSheet(null)}
        options={[
          { value: "", label: "Anyone" },
          { value: "null", label: "Unassigned" },
          ...(agents.data ?? []).map((a) => ({ value: a.id, label: a.name })),
        ]}
      />
      <PropertySheet
        visible={sheet === "project"}
        title="Filter by project"
        selected={projectSel}
        onSelect={setProjectSel}
        onClose={() => setSheet(null)}
        options={[
          { value: "", label: "All projects" },
          ...(projects.data ?? []).map((p) => ({ value: p.id, label: p.name, color: p.color ?? undefined })),
        ]}
      />
      <PropertySheet
        visible={sheet === "sort"}
        title="Sort"
        selected={sortDir}
        onSelect={(v) => setSortDir(v as SortDir)}
        onClose={() => setSheet(null)}
        options={[
          { value: "desc", label: "Newest first" },
          { value: "asc", label: "Oldest first" },
        ]}
      />
    </Screen>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[text.smallMedium, active ? styles.chipTextActive : styles.chipText]} numberOfLines={1}>
        {label}
      </Text>
      <ChevronDown size={13} color={active ? colors.teal : colors.dimForeground} />
    </Pressable>
  );
}

function Board({ issues }: { issues: Issue[] }) {
  const byStatus = useMemo(() => {
    const m = new Map<string, Issue[]>();
    for (const s of BOARD_STATUSES) m.set(s, []);
    for (const it of issues) {
      if (!m.has(it.status)) m.set(it.status, []);
      m.get(it.status)!.push(it);
    }
    return m;
  }, [issues]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.flex} contentContainerStyle={styles.board}>
      {[...byStatus.entries()].map(([status, items]) => (
        <View key={status} style={styles.column}>
          <View style={styles.columnHead}>
            <IssueStatusBadge status={status} />
            <Text style={text.mono}>{items.length}</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ gap: spacing[2] }}>
              {items.map((it) => (
                <Pressable key={it.id} onPress={() => router.push(`/issues/${it.id}`)}>
                  <GlassCard padding={12} radius={14}>
                    <View style={styles.cardHead}>
                      <PriorityIcon priority={it.priority} size={13} />
                    </View>
                    <Text style={text.smallMedium} numberOfLines={3}>
                      {it.title}
                    </Text>
                  </GlassCard>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  controls: { gap: spacing[3], marginBottom: spacing[3] },
  search: { justifyContent: "center" },
  searchIcon: { position: "absolute", left: spacing[4], zIndex: 1 },
  searchInput: { paddingLeft: 42, paddingRight: 42 },
  searchClear: { position: "absolute", right: spacing[4] },
  chips: { gap: spacing[2], paddingRight: spacing[4] },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: colors.white05,
  },
  chipActive: { borderColor: withAlpha(colors.teal, 0.4), backgroundColor: withAlpha(colors.teal, 0.13) },
  chipText: { color: colors.foregroundSoft },
  chipTextActive: { color: colors.teal },
  clear: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 7 },
  clearLabel: { color: colors.dimForeground },
  loading: { gap: spacing[3], marginTop: spacing[4] },
  listContent: { paddingTop: spacing[2], paddingBottom: spacing[6] },
  empty: { textAlign: "center", paddingVertical: spacing[8] },
  board: { gap: spacing[3], paddingTop: spacing[2], paddingRight: spacing[4] },
  column: { width: 230 },
  columnHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing[2] },
  cardHead: { flexDirection: "row", marginBottom: 6 },
});
