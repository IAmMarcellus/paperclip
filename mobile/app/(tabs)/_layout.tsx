import { NativeTabs } from "expo-router/unstable-native-tabs";

import { colors } from "@/theme";

const { Trigger } = NativeTabs;
const { Icon, Label } = Trigger;
const tabContentStyle = { backgroundColor: colors.transparent };

/**
 * Native tab bar. On iOS 26 this renders a real Liquid Glass UITabBar; on
 * Android it's the Material bottom bar. SF Symbols drive the iOS icons
 * (selected = filled). `name` matches each route file in app/(tabs)/.
 *
 * IA: Home · Agents · Tasks · Activity · More.
 * Native bars top out at 5 destinations (iOS auto-collapses extras into a
 * system "More" list; Android crowds), so Org & Settings live under our own
 * More hub (app/(tabs)/more.tsx → /org, /settings, and the rest).
 */
export default function TabsLayout() {
  return (
    <NativeTabs
      tintColor={colors.teal}
      backgroundColor={colors.sidebar}
      shadowColor={colors.white10}
      blurEffect="systemMaterialDark"
    >
      <Trigger name="index" contentStyle={tabContentStyle}>
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Home</Label>
      </Trigger>
      <Trigger name="agents" contentStyle={tabContentStyle}>
        <Icon sf={{ default: "briefcase", selected: "briefcase.fill" }} />
        <Label>Agents</Label>
      </Trigger>
      <Trigger name="tasks" contentStyle={tabContentStyle}>
        <Icon sf={{ default: "list.bullet.rectangle", selected: "list.bullet.rectangle.fill" }} />
        <Label>Tasks</Label>
      </Trigger>
      <Trigger name="activity" contentStyle={tabContentStyle}>
        <Icon sf="waveform.path.ecg" />
        <Label>Activity</Label>
      </Trigger>
      <Trigger name="more" contentStyle={tabContentStyle}>
        <Icon sf="ellipsis" />
        <Label>More</Label>
      </Trigger>
    </NativeTabs>
  );
}
