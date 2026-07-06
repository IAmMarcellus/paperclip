import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { useConnection } from "@/lib/connection";
import { colors, spacing, text } from "@/theme";

/** Entry gate: auto-connect to the env-configured backend, then route to the app. */
export default function Index() {
  const { isConfigured, connectError, baseUrl, retry } = useConnection();

  if (isConfigured) return <Redirect href="/(tabs)" />;

  return (
    <View style={styles.center}>
      {connectError ? (
        <>
          <Text style={[text.title, styles.line]}>Can’t reach Paperclip</Text>
          <Text style={[text.small, styles.line]}>{connectError}</Text>
          <Button label="Retry" onPress={() => retry()} size="lg" style={styles.button} />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.teal} />
          <Text style={[text.small, styles.line]}>Connecting to {baseUrl}…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: spacing[6],
    gap: 12,
  },
  line: { textAlign: "center", maxWidth: 320 },
  button: { marginTop: 8 },
});
