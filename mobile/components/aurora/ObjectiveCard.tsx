/**
 * ObjectiveCard — the breathing "north-star" card (Home objective, Org root).
 * Target label, big gradient value, progress bar, and a context line.
 */
import { LinearGradient } from "expo-linear-gradient";
import { Target } from "lucide-react-native";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import MaskedView from "@react-native-masked-view/masked-view";

import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { colors, diag, gradients, text } from "@/theme";

export interface ObjectiveCardProps {
  label?: string;
  title: string;
  /** 0..1 */
  progress: number;
  /** Big headline value, e.g. "62%". */
  value: string;
  context?: string;
  big?: boolean;
}

export function ObjectiveCard({
  label = "Objective",
  title,
  progress,
  value,
  context,
  big = false,
}: ObjectiveCardProps) {
  const breathe = useSharedValue(0);
  useEffect(() => {
    breathe.value = withRepeat(
      withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [breathe]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.5 + breathe.value * 0.5 }));

  return (
    <View>
      <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none" />
      <GlassCard accent radius={20} padding={18}>
        <View style={styles.headerRow}>
          <Target size={14} color={colors.teal} />
          <Text style={text.label}>{label}</Text>
        </View>
        <View style={styles.titleRow}>
          <Text style={[big ? text.displayXl : text.displayMd, styles.title]} numberOfLines={1}>
            {title}
          </Text>
          <GradientText style={text.displayMd}>{value}</GradientText>
        </View>
        <ProgressBar value={progress} height={9} style={{ marginTop: 12 }} />
        {context ? <Text style={[text.small, { marginTop: 10 }]}>{context}</Text> : null}
      </GlassCard>
    </View>
  );
}

/** Teal→indigo gradient-filled text (used for the headline value). */
function GradientText({ children, style }: { children: string; style?: object }) {
  return (
    <MaskedView maskElement={<Text style={[style, { color: "#000" }]}>{children}</Text>}>
      <LinearGradient colors={gradients.accent} start={diag.start} end={diag.end}>
        <Text style={[style, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: "absolute",
    top: 8,
    left: 24,
    right: 24,
    bottom: 8,
    borderRadius: 24,
    backgroundColor: colors.teal,
    opacity: 0.12,
    // soft halo
    shadowColor: colors.teal,
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 12 },
  titleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  title: { flexShrink: 1 },
});
