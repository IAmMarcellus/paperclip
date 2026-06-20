import { ISSUE_PRIORITIES } from "@paperclipai/shared";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useCreateIssue } from "@/hooks";
import { useConnection } from "@/lib/connection";
import { humanize } from "@/lib/format";
import { ApiError } from "@/lib/api";
import { colors, spacing, text } from "@/theme";

export default function NewIssueScreen() {
  const { companyId } = useConnection();
  const create = useCreateIssue(companyId ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    setError(null);
    create.mutate(
      { title: t, description: description.trim() || undefined, priority },
      {
        onSuccess: (issue) => router.replace(`/issues/${issue.id}`),
        onError: (e) => setError(e instanceof ApiError ? e.message : (e as Error).message),
      },
    );
  };

  return (
    <Screen title="New task" onBack={() => router.back()} scroll={false} bottomInset={spacing[6]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.form}>
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

          {error ? <Text style={[text.small, styles.error]}>{error}</Text> : null}
        </View>

        <Button
          label="Create task"
          onPress={submit}
          loading={create.isPending}
          disabled={!title.trim()}
          fullWidth
          size="lg"
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: "space-between" },
  form: { gap: 6 },
  spacer: { marginTop: spacing[4] },
  textarea: { height: 110, paddingTop: 12, textAlignVertical: "top" },
  error: { color: colors.rose, marginTop: spacing[3] },
});
