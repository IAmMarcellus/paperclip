import { type Href, router } from "expo-router";
import {
  Activity as ActivityIcon,
  type LucideIcon,
  Network,
  Settings as SettingsIcon,
} from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/Screen";
import { ListRow } from "@/components/ui/ListRow";
import { RowsCard } from "@/components/ui/RowsCard";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { colors, spacing, text } from "@/theme";

interface MoreItem {
  label: string;
  hint?: string;
  icon: LucideIcon;
  href: Href;
}
interface MoreSection {
  title: string;
  items: MoreItem[];
}

// Sections grow as later phases land (Projects, Goals, Routines, Costs, …).
const SECTIONS: MoreSection[] = [
  {
    title: "Organization",
    items: [
      { label: "Org map", hint: "Chain of command", icon: Network, href: "/org" },
      { label: "Activity", hint: "Company-wide stream", icon: ActivityIcon, href: "/activity" },
    ],
  },
  {
    title: "Account",
    items: [{ label: "Settings", hint: "Connection & company", icon: SettingsIcon, href: "/settings" }],
  },
];

export default function MoreScreen() {
  return (
    <Screen title="More">
      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <SectionLabel>{section.title}</SectionLabel>
          <RowsCard
            items={section.items}
            keyExtractor={(it) => it.label}
            renderRow={(it) => {
              const Icon = it.icon;
              return (
                <ListRow
                  onPress={() => router.push(it.href)}
                  leading={<Icon size={20} color={colors.teal} />}
                >
                  <Text style={text.bodyMedium} numberOfLines={1}>
                    {it.label}
                  </Text>
                  {it.hint ? (
                    <Text style={text.small} numberOfLines={1}>
                      {it.hint}
                    </Text>
                  ) : null}
                </ListRow>
              );
            }}
          />
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing[5] },
});
