import { ISSUE_PRIORITIES } from "@paperclipai/shared";
import { router } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { useMemo, useState } from "react";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { PropertySheet } from "@/components/ui/PropertySheet";
import { RowsCard } from "@/components/ui/RowsCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useAgents, useCreateIssue, useLabels, useProjects } from "@/hooks";
import { useConnection } from "@/lib/connection";
import { humanize } from "@/lib/format";
import { ApiError } from "@/lib/api";
import { colors, spacing, text } from "@/theme";

type SheetKind = null | "assignee" | "project" | "labels";

export default function NewIssueScreen() {
  const { companyId } = useConnection();
  const cid = companyId ?? "";
  const create = useCreateIssue(cid);
  const agents = useAgents(cid);
  const projects = useProjects(cid);
  const labels = useLabels(cid);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [assigneeAgentId, setAssigneeAgentId] = useState(""); // "" = unassigned
  const [projectId, setProjectId] = useState(""); // "" = none
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [error, setError] = useState<string | null>(null);

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
  const labelName = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of labels.data ?? []) m.set(l.id, l.name);
    return m;
  }, [labels.data]);

  const props = [
    {
      k: "assignee" as const,
      label: "Assignee",
      value: assigneeAgentId ? agentName.get(assigneeAgentId) ?? "Agent" : "Unassigned",
    },
    {
      k: "project" as const,
      label: "Project",
      value: projectId ? projectName.get(projectId) ?? "Project" : "None",
    },
    {
      k: "labels" as const,
      label: "Labels",
      value: labelIds.length ? labelIds.map((id) => labelName.get(id) ?? "label").join(", ") : "None",
    },
  ];

  const toggleLabel = (id: string) =>
    setLabelIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    setError(null);
    create.mutate(
      {
        title: t,
        description: description.trim() || undefined,
        priority,
        // Omit empties: the server validates these as uuid()/uuid[] and 422s on "".
        assigneeAgentId: assigneeAgentId || undefined,
        projectId: projectId || undefined,
        labelIds: labelIds.length ? labelIds : undefined,
      },
      {
        onSuccess: (issue) => router.replace(`/issues/${issue.id}`),
        onError: (e) => setError(e instanceof ApiError ? e.message : (e as Error).message),
      },
    );
  };

  return (
    <Screen title="New task" onBack={() => router.back()} scroll={false} bottomInset={spacing[6]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.form}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={text.label}>Title</Text>
          <Input value={title} onChangeText={setTitle} placeholder="What needs doing?" autoFocus />

          <Text style={[text.label, styles.spacer]}>Description</Text>
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="Optional details…"
            multiline
            style={styles.textarea}
          />

          <Text style={[text.label, styles.spacer]}>Priority</Text>
          <SegmentedControl
            value={priority}
            onChange={setPriority}
            options={ISSUE_PRIORITIES.map((p) => ({ value: p, label: humanize(p) }))}
          />

          <Text style={[text.label, styles.spacer]}>Properties</Text>
          <RowsCard
            items={props}
            keyExtractor={(it) => it.k}
            renderRow={(it) => (
              <ListRow onPress={() => setSheet(it.k)} chevron>
                <Text style={text.small}>{it.label}</Text>
                <Text style={text.bodyMedium} numberOfLines={1}>
                  {it.value}
                </Text>
              </ListRow>
            )}
          />

          {error ? <Text style={[text.small, styles.error]}>{error}</Text> : null}
        </ScrollView>

        <Button
          label="Create task"
          onPress={submit}
          loading={create.isPending}
          disabled={!title.trim()}
          fullWidth
          size="lg"
          style={styles.submit}
        />
      </KeyboardAvoidingView>

      {/* Property sheets */}
      <PropertySheet
        visible={sheet === "assignee"}
        title="Assignee"
        selected={assigneeAgentId}
        onSelect={setAssigneeAgentId}
        onClose={() => setSheet(null)}
        options={[
          { value: "", label: "Unassigned" },
          ...(agents.data ?? []).map((a) => ({ value: a.id, label: a.name })),
        ]}
      />
      <PropertySheet
        visible={sheet === "project"}
        title="Project"
        selected={projectId}
        onSelect={setProjectId}
        onClose={() => setSheet(null)}
        options={[
          { value: "", label: "None" },
          ...(projects.data ?? []).map((p) => ({ value: p.id, label: p.name, color: p.color ?? undefined })),
        ]}
      />
      <PropertySheet
        visible={sheet === "labels"}
        title="Labels"
        multiple
        values={labelIds}
        onToggle={toggleLabel}
        onClose={() => setSheet(null)}
        options={(labels.data ?? []).map((l) => ({ value: l.id, label: l.name, color: l.color }))}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { gap: 6, paddingBottom: spacing[4] },
  spacer: { marginTop: spacing[4] },
  textarea: { height: 110, paddingTop: 12, textAlignVertical: "top" },
  submit: { marginTop: spacing[3] },
  error: { color: colors.rose, marginTop: spacing[3] },
});
