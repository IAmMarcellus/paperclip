import { AGENT_ROLE_LABELS, AGENT_ROLES } from "@paperclipai/shared";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { PropertySheet } from "@/components/ui/PropertySheet";
import { RowsCard } from "@/components/ui/RowsCard";
import { ApiError } from "@/lib/api";
import { useAdapters, useAgents, useCreateAgent } from "@/hooks";
import { useConnection } from "@/lib/connection";
import { humanize } from "@/lib/format";
import { colors, spacing, text } from "@/theme";

type Sheet = null | "role" | "adapter" | "reports";

export default function NewAgentScreen() {
  const { companyId } = useConnection();
  const create = useCreateAgent(companyId ?? "");
  const adapters = useAdapters();
  const agents = useAgents(companyId ?? "");

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState<string>("general");
  const [adapterType, setAdapterType] = useState<string>("");
  const [reportsTo, setReportsTo] = useState<string>("");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [error, setError] = useState<string | null>(null);

  const adapterOptions = (adapters.data ?? [])
    .filter((a) => !a.disabled)
    .map((a) => ({ value: a.type, label: a.label || a.type }));
  const agentName = (id: string) => agents.data?.find((a) => a.id === id)?.name ?? id;

  const submit = () => {
    const t = name.trim();
    if (!t || !adapterType) {
      setError(!t ? "Name is required." : "Pick an adapter.");
      return;
    }
    setError(null);
    create.mutate(
      {
        name: t,
        title: title.trim() || undefined,
        role,
        adapterType,
        reportsTo: reportsTo || undefined,
      },
      {
        onSuccess: (a) => router.replace(`/agents/${a.id}`),
        onError: (e) => setError(e instanceof ApiError ? e.message : (e as Error).message),
      },
    );
  };

  const rows = [
    { k: "role" as const, label: "Role", value: AGENT_ROLE_LABELS[role as keyof typeof AGENT_ROLE_LABELS] ?? humanize(role) },
    { k: "adapter" as const, label: "Adapter", value: adapterType ? adapterType : "Choose…" },
    { k: "reports" as const, label: "Reports to", value: reportsTo ? agentName(reportsTo) : "No one" },
  ];

  return (
    <Screen title="New agent" onBack={() => router.back()} scroll={false} bottomInset={spacing[6]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.form}>
          <Text style={text.label}>Name</Text>
          <Input value={name} onChangeText={setName} placeholder="Agent name" autoFocus />
          <Text style={[text.label, styles.spacer]}>Title</Text>
          <Input value={title} onChangeText={setTitle} placeholder="Optional (e.g. Staff Engineer)" />

          <View style={styles.spacer}>
            <RowsCard
              items={rows}
              keyExtractor={(r) => r.k}
              renderRow={(r) => (
                <ListRow onPress={() => setSheet(r.k)}>
                  <Text style={text.small}>{r.label}</Text>
                  <Text style={text.bodyMedium}>{r.value}</Text>
                </ListRow>
              )}
            />
          </View>

          {error ? <Text style={[text.small, styles.error]}>{error}</Text> : null}
        </ScrollView>

        <Button
          label="Create agent"
          onPress={submit}
          loading={create.isPending}
          disabled={!name.trim() || !adapterType}
          fullWidth
          size="lg"
        />
      </KeyboardAvoidingView>

      <PropertySheet
        visible={sheet === "role"}
        title="Role"
        selected={role}
        onClose={() => setSheet(null)}
        onSelect={setRole}
        options={AGENT_ROLES.map((r) => ({
          value: r,
          label: AGENT_ROLE_LABELS[r] ?? humanize(r),
        }))}
      />
      <PropertySheet
        visible={sheet === "adapter"}
        title="Adapter"
        selected={adapterType}
        onClose={() => setSheet(null)}
        onSelect={setAdapterType}
        options={adapterOptions}
      />
      <PropertySheet
        visible={sheet === "reports"}
        title="Reports to"
        selected={reportsTo}
        onClose={() => setSheet(null)}
        onSelect={setReportsTo}
        options={[
          { value: "", label: "No one" },
          ...(agents.data ?? []).map((a) => ({ value: a.id, label: a.name })),
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: "space-between" },
  form: { gap: 6, paddingBottom: spacing[4] },
  spacer: { marginTop: spacing[4] },
  error: { color: colors.rose, marginTop: spacing[3] },
});
