/**
 * PropertySheet — a bottom-sheet picker (RN Modal + glass; no extra dep). Reused
 * for editing status / priority / assignee / labels inline. Single-select by
 * default (tap selects and closes); pass `multiple` for a toggleable multi-select
 * that stays open (labels, status filters).
 */
import { Check } from "lucide-react-native";
import { type ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassSurface } from "./GlassSurface";
import { Separator } from "./Separator";
import { colors, radii, spacing, text } from "@/theme";

export interface SheetOption {
  value: string;
  label: string;
  /** Optional leading swatch colour or icon. */
  color?: string;
  icon?: ReactNode;
}

export interface PropertySheetProps {
  visible: boolean;
  title: string;
  options: SheetOption[];
  onClose: () => void;
  /** Single-select: the current value (tapping a row selects it and closes). */
  selected?: string | null;
  onSelect?: (value: string) => void;
  /** Multi-select: the selected values (tapping a row toggles, sheet stays open). */
  multiple?: boolean;
  values?: string[];
  onToggle?: (value: string) => void;
}

export function PropertySheet({
  visible,
  title,
  options,
  onClose,
  selected,
  onSelect,
  multiple,
  values,
  onToggle,
}: PropertySheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheetWrap, { paddingBottom: insets.bottom + spacing[3] }]}>
        <GlassSurface radius={radii["2xl"]} style={styles.sheet} intensity={40}>
          <View style={styles.handle} />
          <Text style={[text.label, styles.title]}>{title}</Text>
          <ScrollView style={styles.list} bounces={false}>
            {options.map((opt, i) => {
              const active = multiple
                ? (values ?? []).includes(opt.value)
                : opt.value === selected;
              return (
                <View key={opt.value}>
                  <Pressable
                    style={styles.row}
                    onPress={() => {
                      if (multiple) {
                        onToggle?.(opt.value);
                      } else {
                        onSelect?.(opt.value);
                        onClose();
                      }
                    }}
                  >
                    {opt.icon ??
                      (opt.color ? (
                        <View style={[styles.swatch, { backgroundColor: opt.color }]} />
                      ) : (
                        <View style={styles.swatchSpacer} />
                      ))}
                    <Text style={[text.body, styles.rowLabel]} numberOfLines={1}>
                      {opt.label}
                    </Text>
                    {active ? <Check size={18} color={colors.teal} /> : null}
                  </Pressable>
                  {i < options.length - 1 ? <Separator /> : null}
                </View>
              );
            })}
          </ScrollView>
          {multiple ? (
            <Pressable style={styles.done} onPress={onClose}>
              <Text style={[text.bodyMedium, styles.doneLabel]}>Done</Text>
            </Pressable>
          ) : null}
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" },
  sheetWrap: { position: "absolute", left: spacing[3], right: spacing[3], bottom: 0 },
  sheet: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[2] },
  handle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.white10,
    marginVertical: spacing[2],
  },
  title: { marginBottom: spacing[1] },
  list: { maxHeight: 360 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: 12 },
  rowLabel: { flex: 1 },
  swatch: { width: 12, height: 12, borderRadius: radii.pill },
  swatchSpacer: { width: 12 },
  done: { alignItems: "center", paddingVertical: 12, marginTop: spacing[1] },
  doneLabel: { color: colors.teal },
});
