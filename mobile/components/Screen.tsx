/**
 * Screen — shared scaffold: the Aurora ambient background + a scroll view with
 * consistent insets + an optional large header (greeting/title + right slot).
 * Every tab/stack screen wraps its content in this.
 */
import { type ReactNode } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuroraBackground } from "@/components/aurora/AuroraBackground";
import { colors, spacing, text } from "@/theme";

export interface ScreenProps {
  children: ReactNode;
  /** Big display title (Bricolage). */
  title?: string;
  /** Small line above the title. */
  eyebrow?: string;
  /** Right-aligned header accessory (icon buttons, avatar). */
  headerRight?: ReactNode;
  /** Show the ambient aurora background. Default true. */
  background?: boolean;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Extra bottom padding for the native tab bar. Default 110. */
  bottomInset?: number;
}

export function Screen({
  children,
  title,
  eyebrow,
  headerRight,
  background = true,
  scroll = true,
  onRefresh,
  refreshing = false,
  contentStyle,
  bottomInset = 110,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const header =
    title || eyebrow || headerRight ? (
      <View style={styles.header}>
        <View style={styles.headerText}>
          {eyebrow ? <Text style={[text.small, styles.eyebrow]}>{eyebrow}</Text> : null}
          {title ? <Text style={text.displayLg}>{title}</Text> : null}
        </View>
        {headerRight}
      </View>
    ) : null;

  const padding: StyleProp<ViewStyle> = {
    paddingTop: insets.top + spacing[2],
    paddingHorizontal: spacing[5],
    paddingBottom: bottomInset,
  };

  return (
    <View style={styles.root}>
      {background ? <AuroraBackground /> : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[padding, contentStyle]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.teal}
              />
            ) : undefined
          }
        >
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, padding, contentStyle]}>
          {header}
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    marginBottom: spacing[5],
  },
  headerText: { flexShrink: 1 },
  eyebrow: { marginBottom: 2 },
});
