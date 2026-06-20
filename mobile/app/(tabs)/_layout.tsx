import { NativeTabs } from "expo-router/unstable-native-tabs";

import { colors } from "@/theme";

const { Trigger } = NativeTabs;
const { Icon, Label } = Trigger;

/**
 * Native tab bar. On iOS 26 this renders a real Liquid Glass UITabBar; on
 * Android it's the Material bottom bar. SF Symbols drive the iOS icons
 * (selected = filled). `name` matches each route file in app/(tabs)/.
 */
export default function TabsLayout() {
  return (
    <NativeTabs tintColor={colors.teal}>
      <Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Home</Label>
      </Trigger>
      <Trigger name="agents">
        <Icon sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }} />
        <Label>Agents</Label>
      </Trigger>
      <Trigger name="org">
        <Icon sf="point.3.connected.trianglepath.dotted" />
        <Label>Org</Label>
      </Trigger>
      <Trigger name="activity">
        <Icon sf={{ default: "bell", selected: "bell.fill" }} />
        <Label>Activity</Label>
      </Trigger>
      <Trigger name="settings">
        <Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
        <Label>Settings</Label>
      </Trigger>
    </NativeTabs>
  );
}
