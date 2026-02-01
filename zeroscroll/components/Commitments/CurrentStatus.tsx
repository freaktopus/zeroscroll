import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CommitmentDisplay } from "@/types";
import { getStatusColor } from "@/services/api";

interface CurrentStatusProps {
  commitments: CommitmentDisplay[];
  onCommitmentPress?: (id: string) => void;
}

export default function CurrentStatus({
  commitments,
  onCommitmentPress,
}: CurrentStatusProps) {
  if (commitments.length === 0) {
    return null;
  }

  return (
    <View>
      <View className="mt-4 mb-2 flex-row justify-between items-center">
        <Text className="text-gray-400 text-base">Active Stakes</Text>
        <View className="bg-blue-500/20 px-2 py-1 rounded-full">
          <Text className="text-blue-300 text-xs">
            {commitments.length} active
          </Text>
        </View>
      </View>
      <View className="bg-[#23242b] rounded-2xl p-4 mb-4">
        {commitments.map((item, index) => (
          <Pressable
            key={item.id}
            onPress={() => onCommitmentPress?.(item.id)}
            className={`flex-row justify-between items-center py-3 ${
              index < commitments.length - 1 ? "border-b border-white/5" : ""
            }`}
          >
            <View className="flex-row items-center flex-1">
              {/* Status Indicator */}
              <View
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  item.status === "active"
                    ? "bg-blue-500/20"
                    : item.status === "pending"
                      ? "bg-yellow-500/20"
                      : item.status === "locked"
                        ? "bg-orange-500/20"
                        : "bg-purple-500/20"
                }`}
              >
                <Ionicons
                  name={
                    item.status === "active"
                      ? "play-circle"
                      : item.status === "pending"
                        ? "time"
                        : item.status === "locked"
                          ? "lock-closed"
                          : "hourglass"
                  }
                  size={20}
                  color={
                    item.status === "active"
                      ? "#3b82f6"
                      : item.status === "pending"
                        ? "#eab308"
                        : item.status === "locked"
                          ? "#f97316"
                          : "#a855f7"
                  }
                />
              </View>

              <View className="ml-3 flex-1">
                <Text
                  className="text-white font-semibold text-base"
                  numberOfLines={1}
                >
                  {item.user}
                </Text>
                <View className="flex-row items-center">
                  <Text className="text-gray-400 text-xs">
                    {item.app} • {item.limit}
                  </Text>
                </View>
              </View>
            </View>

            <View className="items-end">
              <Text className="text-white font-bold text-base">
                {item.amount}
              </Text>
              <View className="flex-row items-center">
                <View
                  className={`w-2 h-2 rounded-full mr-1 ${
                    item.status === "active"
                      ? "bg-blue-400"
                      : item.status === "pending"
                        ? "bg-yellow-400"
                        : item.status === "locked"
                          ? "bg-orange-400"
                          : "bg-purple-400"
                  }`}
                />
                <Text
                  className={`text-xs capitalize ${getStatusColor(item.status)}`}
                >
                  {item.status}
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
