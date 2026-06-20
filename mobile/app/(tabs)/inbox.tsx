import { Text } from "react-native";

import { Screen } from "@/components/Screen";
import { text } from "@/theme";

// Stub — segmented Inbox (Needs you / Mine / Unread / Blocked) lands in v2 Phase 3.
export default function InboxScreen() {
  return (
    <Screen title="Inbox">
      <Text style={text.small}>Approvals and your tasks are coming here.</Text>
    </Screen>
  );
}
