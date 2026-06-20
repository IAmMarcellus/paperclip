import { router } from "expo-router";
import { Plug } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/api";
import { useConnection } from "@/lib/connection";
import { DEFAULT_BASE_URL } from "@/lib/config";
import { colors, spacing, text } from "@/theme";

export default function ConnectScreen() {
  const { connect, baseUrl } = useConnection();
  const [url, setUrl] = useState(baseUrl || DEFAULT_BASE_URL);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const companies = await connect({ baseUrl: url, token });
      if (companies.length === 0) {
        setError("Connected, but no companies were found on this server.");
        return;
      }
      router.replace("/(tabs)");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.status === 0
            ? `Could not reach ${url}. Check the address and that Paperclip is running.`
            : `Server responded ${err.status}: ${err.message}`
          : (err as Error).message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll={false} bottomInset={spacing[6]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.center}>
          <View style={styles.brand}>
            <Plug size={28} color={colors.teal} />
            <Text style={[text.displayLg, styles.title]}>Connect to Paperclip</Text>
            <Text style={[text.small, styles.subtitle]}>
              Point the app at your Paperclip server. On the same machine that's{" "}
              {DEFAULT_BASE_URL}; over the LAN use the host's IP.
            </Text>
          </View>

          <GlassCard padding={18} style={styles.form}>
            <Text style={text.label}>Server URL</Text>
            <Input
              value={url}
              onChangeText={setUrl}
              placeholder={DEFAULT_BASE_URL}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={styles.field}
            />
            <Text style={[text.label, styles.spacer]}>Access token (optional)</Text>
            <Input
              value={token}
              onChangeText={setToken}
              placeholder="Bearer token — leave blank for local"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              style={styles.field}
            />
            {error ? <Text style={[text.small, styles.error]}>{error}</Text> : null}
            <Button
              label={loading ? "Connecting…" : "Connect"}
              onPress={onConnect}
              loading={loading}
              fullWidth
              size="lg"
              style={styles.button}
            />
          </GlassCard>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center" },
  brand: { alignItems: "center", marginBottom: spacing[6], gap: 8 },
  title: { textAlign: "center" },
  subtitle: { textAlign: "center", maxWidth: 320 },
  form: { gap: 6 },
  field: { marginTop: 6 },
  spacer: { marginTop: 14 },
  error: { color: colors.rose, marginTop: 12 },
  button: { marginTop: 18 },
});
