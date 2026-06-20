import { fetch as expoFetch } from "expo/fetch";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatThread, type Message } from "@/components/chat/ChatThread";
import { Composer } from "@/components/chat/Composer";
import { IconButton } from "@/components/ui/IconButton";
import { ChevronLeft } from "lucide-react-native";
import { apiConfig } from "@/lib/config";
import { colors, spacing, text } from "@/theme";
import { Text } from "react-native";

/** Best-effort UTF-8 decode (TextDecoder if present, else a minimal fallback). */
function decode(bytes: Uint8Array): string {
  const TD = (globalThis as { TextDecoder?: typeof TextDecoder }).TextDecoder;
  if (TD) return new TD("utf-8").decode(bytes);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

/** Pull a text delta out of one parsed SSE data object (shape varies). */
function deltaOf(data: unknown): string {
  if (typeof data === "string") return data;
  if (!data || typeof data !== "object") return "";
  const o = data as Record<string, any>;
  return (
    o.delta?.content ??
    o.choices?.[0]?.delta?.content ??
    o.content ??
    o.text ??
    o.message?.content ??
    ""
  );
}

export default function BoardChatScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const idRef = useRef(0);

  const send = async (body: string) => {
    const userMsg: Message = { id: `u${idRef.current++}`, role: "user", body };
    const assistantId = `a${idRef.current++}`;
    const history = [...messages, userMsg];
    setMessages([...history, { id: assistantId, role: "agent", authorName: "Board", body: "…" }]);
    setSending(true);

    const append = (text2: string) =>
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, body: text2 } : m)));

    try {
      const res = await expoFetch(`${apiConfig.baseUrl}/api/board/chat/stream`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
          ...(apiConfig.token ? { authorization: `Bearer ${apiConfig.token}` } : {}),
        },
        body: JSON.stringify({
          messages: history.map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.body,
          })),
        }),
      });
      if (!res.ok || !res.body) throw new Error(`Board chat unavailable (${res.status})`);

      const reader = res.body.getReader();
      let buf = "";
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decode(value as Uint8Array);
        const chunks = buf.split("\n\n");
        buf = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          let delta = "";
          try {
            delta = deltaOf(JSON.parse(payload));
          } catch {
            delta = payload;
          }
          acc += delta;
          if (acc) append(acc);
        }
      }
      if (!acc) append("(no response)");
    } catch (e) {
      append(`⚠️ ${(e as Error).message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <IconButton onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.foregroundSoft} />
        </IconButton>
        <Text style={text.title}>Board chat</Text>
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={insets.top + 8}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {messages.length === 0 ? (
            <Text style={[text.small, styles.hint]}>
              Ask the board to direct the company. Experimental — requires board chat enabled on the server.
            </Text>
          ) : (
            <ChatThread messages={messages} />
          )}
        </ScrollView>
        <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
          <Composer onSend={send} sending={sending} placeholder="Direct the company…" />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  nav: { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingHorizontal: spacing[4], paddingBottom: 8 },
  content: { paddingHorizontal: spacing[5], paddingTop: spacing[2], paddingBottom: spacing[4] },
  hint: { textAlign: "center", paddingVertical: spacing[8] },
  composer: { paddingHorizontal: spacing[4], paddingTop: 6 },
});
