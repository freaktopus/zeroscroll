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
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { View, ActivityIndicator } from "react-native";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useEffect } from "react";
import * as NavigationBar from "expo-navigation-bar";

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  useSafeAreaInsets(); // Hook required by some components
  const { isLoading, isAuthenticated, pendingRegistration } = useAuth();

  useEffect(() => {
    // Hide Android system navigation bar in immersive mode (shows on swipe up)
    const configureNavigationBar = async () => {
      try {
        await NavigationBar.setVisibilityAsync("hidden");
      } catch (error) {
        console.log("Navigation bar configuration not available:", error);
      }
    };
    configureNavigationBar();
  }, []);

  // Auth-aware navigation: redirect based on auth state
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (isAuthenticated && inAuthGroup) {
      // Authenticated user on auth screens → go to tabs
      console.log("[ROOT] Authenticated → tabs");
      router.replace("/(tabs)");
    } else if (!isAuthenticated && !pendingRegistration && !inAuthGroup) {
      // Not authenticated, not registering, not on auth screens → login
      console.log("[ROOT] Not authenticated → login");
      router.replace("/(auth)/login");
    }
    // pendingRegistration + on register page → stay (don't redirect)
  }, [isLoading, isAuthenticated, pendingRegistration, segments, router]);

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
