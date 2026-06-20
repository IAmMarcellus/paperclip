import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useConnection } from "@/lib/connection";
import { colors } from "@/theme";

/** Entry gate: wait for hydration, then route to the app or the Connect screen. */
export default function Index() {
  const { hydrated, isConfigured } = useConnection();

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  return isConfigured ? <Redirect href="/(tabs)" /> : <Redirect href="/connect" />;
}
