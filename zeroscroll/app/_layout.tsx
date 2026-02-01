// Polyfills - MUST be imported first, in this exact order
import "react-native-get-random-values"; // Must be first for crypto support
import { Buffer } from "buffer";
global.Buffer = global.Buffer || Buffer;

import "../global.css";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { View, ActivityIndicator } from "react-native";
import { AuthProvider, useAuth } from "@/context/AuthContext";

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  useSafeAreaInsets(); // Hook required by some components
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#181A20] items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" hidden={true} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
