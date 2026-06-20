import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Check } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/Screen";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { ListRow } from "@/components/ui/ListRow";
import { RowsCard } from "@/components/ui/RowsCard";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Separator } from "@/components/ui/Separator";
import { api } from "@/lib/api";
import { useConnection } from "@/lib/connection";
import { colors, spacing, text } from "@/theme";

export default function SettingsScreen() {
  const { baseUrl, companyId, user, setCompanyId, disconnect } = useConnection();
  const companies = useQuery({ queryKey: ["companies"], queryFn: () => api.listCompanies() });

  const onDisconnect = async () => {
    await disconnect();
    router.replace("/connect");
  };

  return (
    <Screen title="Settings">
      <SectionLabel>Account</SectionLabel>
      <GlassCard padding={16}>
        <View style={styles.account}>
          <Avatar name={user?.name ?? "You"} imageUri={user?.image} size={44} />
          <View style={{ flex: 1 }}>
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

      <View style={styles.block}>
        <Button label="Disconnect" variant="destructive" fullWidth size="lg" onPress={onDisconnect} />
      </View>
    </Screen>
  );
}

function Row({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.row}>
      <Text style={text.small}>{label}</Text>
      <Text style={[text.smallMedium, tint ? { color: tint } : null]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  account: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  block: { marginTop: spacing[6] },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 6 },
  sep: { marginVertical: 6 },
});
