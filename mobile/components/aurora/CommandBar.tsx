/**
 * CommandBar — the "Direct your company…" input on Home. Glass pill with a
 * sparkles glyph, a text field, and a circular gradient send button.
 */
import { LinearGradient } from "expo-linear-gradient";
import { ArrowUp, Sparkles } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { GlassSurface } from "@/components/ui/GlassSurface";
import { colors, diag, fontFamily, gradients, radii } from "@/theme";

export interface CommandBarProps {
  placeholder?: string;
  onSubmit?: (value: string) => void;
}

export function CommandBar({ placeholder = "Direct your company…", onSubmit }: CommandBarProps) {
  const [value, setValue] = useState("");
  const submit = () => {
    const v = value.trim();
    if (v) onSubmit?.(v);
    setValue("");
  };
  return (
    <GlassSurface radius={radii.pill} style={styles.bar}>
      <Sparkles size={18} color={colors.teal} />
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={colors.dimForeground}
        style={styles.input}
        returnKeyType="send"
        onSubmitEditing={submit}
      />
      <Pressable onPress={submit} style={styles.send}>
        <LinearGradient colors={gradients.accent} start={diag.start} end={diag.end} style={StyleSheet.absoluteFill} />
        <ArrowUp size={18} color={colors.primaryForeground} />
      </Pressable>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 52,
    paddingLeft: 16,
    paddingRight: 6,
  },
  input: {
    flex: 1,
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
