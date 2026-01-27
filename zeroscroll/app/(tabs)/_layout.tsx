import { Tabs, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, BackHandler, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

const STORAGE_KEY = "wallet_address";

export default function TabLayout() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [ready, setReady] = useState(false);


  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setReady(false);

      (async () => {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;

        if (!saved) {
          router.replace("/(auth)/login"); // kicks you out immediately
          return;
        }
        setReady(true);
      })();

      return () => {
        cancelled = true;
      };
    }, [router]),
  );

  if (!ready) {
    return (
      <View className="flex-1 bg-[#181A20] items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Recents",
          tabBarIcon: () => (
            <MaterialIcons size={28} name="space-dashboard" color="white" />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "Leaderboard",
          tabBarIcon: () => (
            <MaterialIcons size={28} name="leaderboard" color="white" />
          ),
        }}
      />

      <Tabs.Screen
        name="addStake"
        options={{
          title: "Add Stake",
          tabBarIcon: () => (
            <MaterialIcons size={28} name="add" color="white" />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: () => (
            <MaterialIcons size={28} name="settings" color="white" />
          ),
        }}
      />
    </Tabs>
  );
}
