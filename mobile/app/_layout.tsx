import "react-native-gesture-handler";

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { View } from "react-native";

import { AuroraBackground } from "@/components/aurora/AuroraBackground";
import { ConnectionProvider } from "@/lib/connection";
import { queryClient } from "@/lib/query";
import { colors, useAuroraFonts } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const fontsLoaded = useAuroraFonts();

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ConnectionProvider>
            <StatusBar style="light" />
            {/* Single ambient Aurora canvas behind the whole app — screens render
                on transparent backgrounds so it shows through (and only one set of
                orb animations runs, not one per mounted screen). */}
            <View style={{ flex: 1, backgroundColor: colors.background }}>
              <AuroraBackground />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: "transparent" },
                  animation: "fade",
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="agents/[agentId]" />
                <Stack.Screen name="agents/new" options={{ presentation: "modal" }} />
                <Stack.Screen name="board-chat" />
                <Stack.Screen name="issues/[issueId]" />
                <Stack.Screen name="issues/new" options={{ presentation: "modal" }} />
                <Stack.Screen name="projects/new" options={{ presentation: "modal" }} />
                <Stack.Screen name="goals/new" options={{ presentation: "modal" }} />
                <Stack.Screen name="approvals/[approvalId]" />
                <Stack.Screen name="runs/[runId]" />
                <Stack.Screen name="voice" />
                <Stack.Screen name="index" />
              </Stack>
            </View>
          </ConnectionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
