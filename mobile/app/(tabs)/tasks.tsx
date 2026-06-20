import { Text } from "react-native";

import { Screen } from "@/components/Screen";
import { text } from "@/theme";

// Stub — Issues list/board + IssueDetail land in v2 Phase 2.
export default function TasksScreen() {
  return (
    <Screen title="Tasks">
      <Text style={text.small}>Issues are coming here.</Text>
    </Screen>
  );
}
