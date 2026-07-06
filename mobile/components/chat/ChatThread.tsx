/**
 * Generic chat thread used by IssueDetail and BoardChat. Callers map their
 * domain objects (IssueComment, board messages) onto `Message`.
 */
import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AgentChip } from "@/components/aurora/AgentChip";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { MarkdownBody } from "@/components/ui/MarkdownBody";
import { colors, fontFamily, gradients, radii, spacing, text, vert } from "@/theme";
import { LinearGradient } from "expo-linear-gradient";

export interface Message {
  id: string;
  role: "user" | "agent" | "system";
  authorId?: string | null;
  authorName?: string | null;
  body: string;
  time?: string;
}

export function MessageBubble({ message }: { message: Message }) {
  if (message.role === "system") {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>{message.body}</Text>
      </View>
    );
  }

  const isUser = message.role === "user";
  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAgent]}>
      <View style={[styles.bubbleWrap, isUser && styles.bubbleWrapUser]}>
        {!isUser && (
          <View style={styles.author}>
            <AgentChip
              agent={{ id: message.authorId, name: message.authorName }}
              name={message.authorName ?? "Agent"}
            />
            {message.time ? <Text style={styles.time}>{message.time}</Text> : null}
          </View>
        )}
        {isUser ? (
          <View style={styles.userBubble}>
            <LinearGradient
              colors={gradients.accent}
              start={vert.start}
              end={vert.end}
              style={[StyleSheet.absoluteFill, { opacity: 0.16, borderRadius: radii.lg }]}
            />
            <MarkdownBody color={colors.foreground}>{message.body}</MarkdownBody>
          </View>
        ) : (
          <GlassSurface radius={radii.lg} style={styles.agentBubble}>
            <MarkdownBody>{message.body}</MarkdownBody>
          </GlassSurface>
        )}
      </View>
    </View>
  );
}

export function ChatThread({ messages, footer }: { messages: Message[]; footer?: ReactNode }) {
  return (
    <View style={styles.thread}>
      {messages.length === 0 ? (
        <Text style={[text.small, styles.empty]}>No messages yet. Start the conversation below.</Text>
      ) : (
        messages.map((m) => <MessageBubble key={m.id} message={m} />)
      )}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  thread: { gap: spacing[4] },
  row: { flexDirection: "row" },
  rowAgent: { justifyContent: "flex-start" },
  rowUser: { justifyContent: "flex-end" },
  bubbleWrap: { maxWidth: "88%", gap: 6 },
  bubbleWrapUser: { alignItems: "flex-end" },
  author: { flexDirection: "row", alignItems: "center", gap: 8 },
  time: { fontFamily: fontFamily.mono, fontSize: 10, color: colors.dimForeground },
  agentBubble: { padding: spacing[3] },
  userBubble: {
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    overflow: "hidden",
  },
  systemRow: { alignItems: "center", paddingVertical: 2 },
  systemText: { fontFamily: fontFamily.mono, fontSize: 11, color: colors.dimForeground },
  empty: { textAlign: "center", paddingVertical: spacing[6] },
});
