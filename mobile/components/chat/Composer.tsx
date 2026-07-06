/** Chat composer: multiline input + circular gradient send button. */
import { LinearGradient } from "expo-linear-gradient";
import { ArrowUp } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";

import { GlassSurface } from "@/components/ui/GlassSurface";
import { colors, diag, fontFamily, gradients, radii, spacing } from "@/theme";

export interface ComposerProps {
  onSend: (value: string) => void;
  sending?: boolean;
  placeholder?: string;
}

export function Composer({ onSend, sending, placeholder = "Message…" }: ComposerProps) {
  const [value, setValue] = useState("");
  const submit = () => {
    const v = value.trim();
    if (!v || sending) return;
    onSend(v);
    setValue("");
  };
  return (
    <GlassSurface radius={radii.xl} style={styles.bar}>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={colors.dimForeground}
        style={styles.input}
        multiline
      />
      <Pressable onPress={submit} style={styles.send} disabled={sending}>
        <LinearGradient colors={gradients.accent} start={diag.start} end={diag.end} style={StyleSheet.absoluteFill} />
        {sending ? (
          <ActivityIndicator size="small" color={colors.primaryForeground} />
        ) : (
          <ArrowUp size={18} color={colors.primaryForeground} />
        )}
      </Pressable>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing[2],
    paddingLeft: spacing[4],
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 120,
    paddingTop: 9,
    paddingBottom: 6,
    color: colors.foreground,
    fontFamily: fontFamily.sans,
    fontSize: 15,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});
