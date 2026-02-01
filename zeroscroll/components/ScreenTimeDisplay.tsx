import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useScreenTime } from "@/hooks/useScreenTime";
import type { AppUsageStats } from "@/modules/screen-time";

interface ScreenTimeDisplayProps {
  targetApp?: string;
  targetLimit?: number; // in minutes
}

export default function ScreenTimeDisplay({
  targetApp,
  targetLimit,
}: ScreenTimeDisplayProps) {
  const {
    isModuleAvailable,
    hasPermission,
    isLoading,
    totalScreenTimeToday,
    todayStats,
    requestPermission,
    refresh,
    formatDuration,
  } = useScreenTime();

  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Loading timeout - if still loading after 5 seconds, show anyway
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setLoadingTimeout(false);
    }
  }, [isLoading]);

  // If module not available (needs native rebuild)
  if (!isModuleAvailable) {
    return (
      <View className="bg-[#23242b] rounded-2xl p-4 mb-4">
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-gray-500/15 items-center justify-center mr-3">
            <Ionicons name="time" size={20} color="#6b7280" />
          </View>
          <View className="flex-1">
            <Text className="text-white font-semibold">Screen Time</Text>
            <Text className="text-gray-400 text-sm">
              Rebuild app to enable tracking
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // If no permission, show request button
  if (!hasPermission && !isLoading) {
    const handleRequestPermission = async () => {
      await requestPermission();
      // Show help dialog after opening settings
      setTimeout(() => {
        Alert.alert(
          "Enable Usage Access",
          "On Samsung devices:\n\n" +
            "1. Find 'zeroscroll' in the list\n" +
            "2. Toggle it ON\n\n" +
            "If you don't see it:\n" +
            "• Go to Settings → Apps → zeroscroll → Permissions\n" +
            "• Or search 'Usage data access' in Settings",
          [{ text: "OK" }],
        );
      }, 500);
    };

    return (
      <View className="bg-[#23242b] rounded-2xl p-4 mb-4">
        <View className="flex-row items-center mb-3">
          <View className="w-10 h-10 rounded-full bg-yellow-500/15 items-center justify-center mr-3">
            <Ionicons name="time" size={20} color="#eab308" />
          </View>
          <View className="flex-1">
            <Text className="text-white font-semibold">Screen Time Access</Text>
            <Text className="text-gray-400 text-sm">
              Required to track app usage
            </Text>
          </View>
        </View>
        <Pressable
          onPress={handleRequestPermission}
          className="bg-blue-500 rounded-xl py-3 items-center"
        >
          <Text className="text-white font-semibold">Grant Permission</Text>
        </Pressable>
        <Text className="text-gray-500 text-xs text-center mt-2">
          Samsung: Settings → Apps → zeroscroll → Permissions
        </Text>
      </View>
    );
  }

  if (isLoading && !loadingTimeout) {
    return (
      <View className="bg-[#23242b] rounded-2xl p-4 mb-4 items-center">
        <ActivityIndicator size="small" color="#3b82f6" />
        <Text className="text-gray-400 text-sm mt-2">
          Loading screen time...
        </Text>
      </View>
    );
  }

  // Find target app usage if specified
  const targetAppUsage = targetApp
    ? todayStats.find((app) => app.packageName === targetApp)
    : null;

  const targetUsageMinutes = targetAppUsage
    ? Math.floor(targetAppUsage.totalTimeInForeground / (1000 * 60))
    : 0;

  const isOverLimit = targetLimit && targetUsageMinutes > targetLimit;

  return (
    <View className="bg-[#23242b] rounded-2xl p-4 mb-4">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-white text-lg font-semibold">
          {"Today's Screen Time"}
        </Text>
        <Pressable onPress={refresh}>
          <Ionicons name="refresh" size={20} color="#6b7280" />
        </Pressable>
      </View>

      {/* Total Screen Time */}
      <View className="bg-[#1a1b20] rounded-xl p-4 mb-4">
        <Text className="text-gray-400 text-xs">Total Usage</Text>
        <Text className="text-white text-2xl font-bold mt-1">
          {formatDuration(totalScreenTimeToday)}
        </Text>
      </View>

      {/* Target App Status (if tracking specific app) */}
      {targetApp && (
        <View
          className={`rounded-xl p-4 mb-4 ${isOverLimit ? "bg-red-500/15" : "bg-green-500/15"}`}
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-gray-400 text-xs">
                {targetAppUsage?.appName || targetApp}
              </Text>
              <Text
                className={`text-xl font-bold mt-1 ${isOverLimit ? "text-red-400" : "text-green-400"}`}
              >
                {formatDuration(targetAppUsage?.totalTimeInForeground || 0)}
              </Text>
            </View>
            {targetLimit && (
              <View className="items-end">
                <Text className="text-gray-400 text-xs">Limit</Text>
                <Text className="text-white font-semibold">{targetLimit}m</Text>
              </View>
            )}
          </View>
          {isOverLimit && (
            <View className="flex-row items-center mt-2">
              <Ionicons name="warning" size={16} color="#ef4444" />
              <Text className="text-red-400 text-sm ml-1">
                Over limit by {targetUsageMinutes - (targetLimit || 0)} minutes
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Top Apps */}
      <Text className="text-gray-400 text-sm mb-2">Top Apps</Text>
      <FlatList
        data={todayStats.slice(0, 5)}
        keyExtractor={(item, index) => `${item.packageName}-${index}`}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <AppUsageRow app={item} formatDuration={formatDuration} />
        )}
        ListEmptyComponent={
          <Text className="text-gray-500 text-center py-4">
            No usage data available
          </Text>
        }
      />
    </View>
  );
}

function AppUsageRow({
  app,
  formatDuration,
}: {
  app: AppUsageStats;
  formatDuration: (ms: number) => string;
}) {
  return (
    <View className="flex-row items-center py-2 border-b border-white/5">
      <View className="w-8 h-8 rounded-lg bg-gray-700 items-center justify-center mr-3">
        <Text className="text-white text-xs font-bold">
          {app.appName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-white font-medium" numberOfLines={1}>
          {app.appName}
        </Text>
        <Text className="text-gray-500 text-xs" numberOfLines={1}>
          {app.packageName}
        </Text>
      </View>
      <Text className="text-gray-300 font-semibold">
        {formatDuration(app.totalTimeInForeground)}
      </Text>
    </View>
  );
}
