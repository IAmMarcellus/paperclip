import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Check, Mic } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/Screen";
import { Avatar } from "@/components/ui/Avatar";
import { GlassCard } from "@/components/ui/GlassCard";
import { ListRow } from "@/components/ui/ListRow";
import { RowsCard } from "@/components/ui/RowsCard";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Separator } from "@/components/ui/Separator";
import { api } from "@/lib/api";
import { useConnection } from "@/lib/connection";
import { colors, spacing, text } from "@/theme";

export default function SettingsScreen() {
  const { baseUrl, companyId, user, setCompanyId } = useConnection();
  const companies = useQuery({ queryKey: ["companies"], queryFn: () => api.listCompanies() });

  return (
    <Screen
      header={
        <View style={styles.screenHeader}>
          <Text style={text.displayLg}>Settings</Text>
          <Text style={[text.small, styles.headerMeta]}>Account, company, and connection</Text>
        </View>
      }
      onBack={() => router.back()}
    >
      <SectionLabel>Account</SectionLabel>
      <GlassCard padding={16}>
        <View style={styles.account}>
          <Avatar name={user?.name ?? "You"} imageUri={user?.image} size={44} />
          <View style={styles.accountCopy}>
            <Text style={text.title} numberOfLines={1}>
              {user?.name ?? "Local board"}
            </Text>
            <Text style={text.small} numberOfLines={1}>
              {user?.email ?? "Connected without authentication"}
            </Text>
          </View>
        </View>
      </GlassCard>

      <View style={styles.block}>
        <SectionLabel>Connection</SectionLabel>
        <GlassCard padding={16}>
          <Row label="Server" value={baseUrl} />
          <Separator style={styles.sep} />
          <Row label="Status" value="Connected" tint={colors.emerald} />
        </GlassCard>
      </View>

      <View style={styles.block}>
        <SectionLabel>Assistant</SectionLabel>
        <RowsCard
          items={[{ id: "mergatroid" }]}
          keyExtractor={(it) => it.id}
          renderRow={() => (
            <ListRow onPress={() => router.push("/voice")} leading={<Mic size={20} color={colors.teal} />}>
              <Text style={text.bodyMedium} numberOfLines={1}>
                Talk to Mergatroid
              </Text>
              <Text style={text.small} numberOfLines={1}>
                Voice · all companies
              </Text>
            </ListRow>
          )}
        />
      </View>

      {(companies.data?.length ?? 0) > 1 ? (
        <View style={styles.block}>
          <SectionLabel>Company</SectionLabel>
          <RowsCard
            items={companies.data!}
            keyExtractor={(c) => c.id}
            renderRow={(c) => (
              <ListRow
                chevron={false}
                onPress={() => setCompanyId(c.id)}
                trailing={c.id === companyId ? <Check size={18} color={colors.teal} /> : undefined}
              >
                <Text style={text.bodyMedium} numberOfLines={1}>
                  {c.name}
                </Text>
              </ListRow>
            )}
          />
        </View>
      ) : null}
    </Screen>
  );
}

function Row({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.row}>
      <Text style={text.small}>{label}</Text>
      <Text style={[text.smallMedium, styles.rowValue, tint ? { color: tint } : null]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screenHeader: { marginBottom: spacing[4] },
  headerMeta: { color: colors.dimForeground, marginTop: 3 },
  account: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  accountCopy: { flex: 1, minWidth: 0 },
  block: { marginTop: spacing[6] },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 6 },
  rowValue: { flex: 1, minWidth: 0, textAlign: "right" },
  sep: { marginVertical: 6 },
});
