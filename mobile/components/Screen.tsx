/**
 * Screen — shared scaffold: a scroll view with consistent insets + an optional
 * large header (greeting/title + right slot). Each scene owns its ambient
 * Aurora canvas so native tab scene hosts cannot cover the gradient.
 */
import { ChevronLeft } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import {
  Platform,
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
import { IconButton } from "@/components/ui/IconButton";
import { colors, spacing, text } from "@/theme";

export interface ScreenProps {
  children: ReactNode;
  /** Big display title (Bricolage). */
  title?: string;
  /** Small line above the title. */
  eyebrow?: string;
  /** Right-aligned header accessory (icon buttons, avatar). */
  headerRight?: ReactNode;
  /** Fully custom header content. Replaces title/eyebrow/headerRight. */
  header?: ReactNode;
  /** Full-screen ambient layer rendered behind the padded content (above the
   *  Aurora) — e.g. the Mergatroid nebula. Bleeds edge-to-edge, ignoring the
   *  content padding, so it never reads as an inset "box". */
  background?: ReactNode;
  /** When set, renders a back button above the header (for pushed stack screens). */
  onBack?: () => void;
  scroll?: boolean;
  onRefresh?: () => void | Promise<unknown>;
  refreshing?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Extra bottom padding for the native tab bar. Default 110. */
  bottomInset?: number;
  /** Horizontal content padding. Default matches the Aurora mobile comps. */
  contentPaddingHorizontal?: number;
  /** Top spacing below the native safe area. */
  contentPaddingTop?: number;
}

export function Screen({
  children,
  title,
  eyebrow,
  headerRight,
  header,
  background,
  onBack,
  scroll = true,
  onRefresh,
  refreshing = false,
  contentStyle,
  bottomInset = 110,
  contentPaddingHorizontal = 18,
  contentPaddingTop = spacing[2],
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const handleRefresh = onRefresh
    ? () => {
        setPullRefreshing(true);
        Promise.resolve(onRefresh()).finally(() => setPullRefreshing(false));
      }
    : undefined;

  const builtHeader =
    header || title || eyebrow || headerRight || onBack ? (
      <View>
        {onBack ? (
          <View style={styles.backRow}>
            <IconButton onPress={onBack}>
              <ChevronLeft size={20} color={colors.foregroundSoft} />
            </IconButton>
          </View>
        ) : null}
        {/* A custom `header` replaces the default title row, but the back button
            (when present) still renders above it so pushed custom-header screens
            stay escapable. */}
        {header ??
          (title || eyebrow || headerRight ? (
            <View style={styles.header}>
              <View style={styles.headerText}>
                {eyebrow ? <Text style={[text.small, styles.eyebrow]}>{eyebrow}</Text> : null}
                {title ? <Text style={text.displayLg}>{title}</Text> : null}
              </View>
              {headerRight}
            </View>
          ) : null)}
      </View>
    ) : null;

  const scrollPadding: StyleProp<ViewStyle> = {
    paddingTop: Platform.OS === "ios" ? contentPaddingTop : insets.top + contentPaddingTop,
    paddingHorizontal: contentPaddingHorizontal,
    paddingBottom: Platform.OS === "ios" ? spacing[6] : insets.bottom + bottomInset,
  };

  const fixedPadding: StyleProp<ViewStyle> = {
    paddingTop: insets.top + contentPaddingTop,
    paddingHorizontal: contentPaddingHorizontal,
    paddingBottom: insets.bottom + bottomInset,
  };

  return (
    <View style={styles.root}>
      <AuroraBackground />
      {background}
      {scroll ? (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentInset={{ bottom: bottomInset }}
          scrollIndicatorInsets={{ bottom: bottomInset }}
          contentContainerStyle={[scrollPadding, contentStyle]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            handleRefresh ? (
              <RefreshControl
                refreshing={pullRefreshing || refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.teal}
              />
            ) : undefined
          }
        >
          {builtHeader}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, fixedPadding, contentStyle]}>
          {builtHeader}
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.transparent },
  flex: { flex: 1 },
  backRow: { flexDirection: "row", marginBottom: spacing[3] },
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
