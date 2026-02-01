import { Tabs, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ActivityIndicator, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/context/AuthContext";

export default function TabLayout() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [ready, setReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      console.log(
        "[TABS] useFocusEffect - isAuthenticated:",
        isAuthenticated,
        "isLoading:",
        isLoading,
        "user:",
        !!user,
      );
      if (isLoading) {
        console.log("[TABS] Still loading, waiting...");
        return;
      }

      if (!isAuthenticated || !user) {
        console.log("[TABS] Not authenticated, redirecting to login");
        router.replace("/(auth)/login");
        return;
      }

      // User is authenticated
      console.log("[TABS] Authenticated! Setting ready=true");
      setReady(true);
    }, [isAuthenticated, isLoading, user, router]),
  );

  if (!ready || isLoading) {
    return (
      <View className="flex-1 bg-[#181A20] items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        tabBarStyle: {
          backgroundColor: "#1a1b1e",
          borderTopColor: "#333",
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <MaterialIcons size={28} name="home" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "Leaderboard",
          tabBarIcon: ({ color }) => (
            <MaterialIcons size={28} name="leaderboard" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="addStake"
        options={{
          title: "New Stake",
          tabBarIcon: ({ color }) => (
            <MaterialIcons size={28} name="add-circle" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <MaterialIcons size={28} name="person" color={color} />
          ),
        }}
      />

      {/* Hidden screen - accessible via navigation */}
      <Tabs.Screen
        name="stake_details"
        options={{
          href: null, // Hide from tab bar
          title: "Wallet Details",
        }}
      />
    </Tabs>
  );
}
