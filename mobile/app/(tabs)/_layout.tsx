import { NativeTabs } from "expo-router/unstable-native-tabs";

import { colors } from "@/theme";

const { Trigger } = NativeTabs;
const { Icon, Label } = Trigger;

/**
 * Native tab bar. On iOS 26 this renders a real Liquid Glass UITabBar; on
 * Android it's the Material bottom bar. SF Symbols drive the iOS icons
 * (selected = filled). `name` matches each route file in app/(tabs)/.
 *
 * IA: Home · Tasks · Inbox · Agents · More. Org / Activity / Settings and the
 * long-tail screens live behind the More hub (plain stack routes).
 */
export default function TabsLayout() {
  return (
    <NativeTabs tintColor={colors.teal}>
      <Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Home</Label>
      </Trigger>
      <Trigger name="tasks">
        <Icon sf="checklist" />
        <Label>Tasks</Label>
      </Trigger>
      <Trigger name="inbox">
        <Icon sf={{ default: "tray", selected: "tray.fill" }} />
        <Label>Inbox</Label>
      </Trigger>
      <Trigger name="agents">
        <Icon sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }} />
        <Label>Agents</Label>
      </Trigger>
      <Trigger name="more">
        <Icon sf={{ default: "ellipsis.circle", selected: "ellipsis.circle.fill" }} />
        <Label>More</Label>
      </Trigger>
    </NativeTabs>
  );
}
