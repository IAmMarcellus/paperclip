/**
 * Button — mirrors the web `Button` variants (vendor/paperclip/ui/src/components/ui/button.tsx):
 *   default (teal→indigo gradient) · cta (solid foreground) · destructive ·
 *   outline (glass) · secondary · ghost · link.
 * Pill-shaped like the web (rounded-full).
 */
import { LinearGradient } from "expo-linear-gradient";
import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { colors, diag, fontFamily, gradients, radii, spacing } from "@/theme";

export type ButtonVariant =
  | "default"
  | "cta"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link";
export type ButtonSize = "sm" | "default" | "lg";

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon node (e.g. a lucide icon). */
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  /** Stretch to fill the parent row. */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const HEIGHT: Record<ButtonSize, number> = { sm: 36, default: 44, lg: 50 };
const PADDING: Record<ButtonSize, number> = { sm: 14, default: 18, lg: 22 };

export function Button({
  label,
  onPress,
  variant = "default",
  size = "default",
  icon,
  disabled,
  loading,
  fullWidth,
  style,
}: ButtonProps) {
  const isGradient = variant === "default";
  const fg = foregroundColor(variant);

  const shape: ViewStyle = {
    height: HEIGHT[size],
    // `fullWidth` sets flex:1 (flexBasis:0) so the button can split a row. Inside
    // an auto-height *column* (e.g. the Connect card) that basis collapses the
    // button's height to 0, making it invisible/untappable. minHeight clamps the
    // main-axis size in columns without affecting the width split in rows.
    minHeight: HEIGHT[size],
    paddingHorizontal: PADDING[size],
    borderRadius: variant === "link" ? 0 : radii.pill,
    borderCurve: "continuous",
    opacity: disabled ? 0.5 : 1,
    alignSelf: fullWidth ? "stretch" : "flex-start",
    flex: fullWidth ? 1 : undefined,
  };

  const inner = (
    <View style={styles.row}>
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, { color: fg }, variant === "link" && styles.linkLabel]}>
            {label}
          </Text>
        </>
      )}
    </View>
  );

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        shape,
        !isGradient && variantStyle(variant),
        pressed && !disabled && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
    >
      {isGradient && (
        <LinearGradient
          colors={gradients.accent}
          start={diag.start}
          end={diag.end}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      {inner}
    </Pressable>
  );
}

function foregroundColor(v: ButtonVariant): string {
  switch (v) {
    case "default":
      return colors.primaryForeground;
    case "cta":
      return colors.background;
    case "destructive":
      return colors.destructiveForeground;
    case "link":
      return colors.primary;
    default:
      return colors.foreground;
  }
}

function variantStyle(v: ButtonVariant): ViewStyle {
  switch (v) {
    case "cta":
      return { backgroundColor: colors.foreground };
    case "destructive":
      return { backgroundColor: colors.destructive };
    case "outline":
      return { borderWidth: 1, borderColor: colors.white10, backgroundColor: colors.white05 };
    case "secondary":
      return { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.white10 };
    case "ghost":
    case "link":
    default:
      return { backgroundColor: "transparent" };
  }
}

const styles = StyleSheet.create({
  base: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
  },
  label: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 15,
  },
  linkLabel: {
    textDecorationLine: "underline",
  },
  pressed: {
    opacity: 0.85,
  },
});
