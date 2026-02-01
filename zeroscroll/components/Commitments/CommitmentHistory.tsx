import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CommitmentDisplay } from "@/types";
import { getStatusColor } from "@/services/api";

interface CommitmentHistoryProps {
  commitments: CommitmentDisplay[];
  onCommitmentPress?: (id: string) => void;
}

export default function CommitmentHistory({
  commitments,
  onCommitmentPress,
}: CommitmentHistoryProps) {
  if (commitments.length === 0) {
    return null;
  }

  return (
    <View>
      <View className="mt-4 mb-2 flex-row justify-between items-center">
        <View>
          <Text className="text-gray-400 text-base">Transaction History</Text>
          <Text className="text-gray-500 text-sm">Past commitments</Text>
        </View>
      </View>

      <View className="bg-[#23242b] rounded-2xl p-4 mb-5">
        {commitments.map((item, index) => (
          <Pressable
            key={item.id}
            onPress={() => onCommitmentPress?.(item.id)}
            className={`flex-row justify-between items-center py-3 ${
              index < commitments.length - 1 ? "border-b border-white/5" : ""
            }`}
          >
            <View className="flex-row items-center flex-1">
              {/* Result Indicator */}
              <View
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  item.status.toLowerCase() === "won" ||
                  item.status.toLowerCase() === "received"
                    ? "bg-green-500/20"
                    : item.status.toLowerCase() === "lost" ||
                        item.status.toLowerCase() === "loss"
                      ? "bg-red-500/20"
                      : item.status.toLowerCase() === "cancelled"
                        ? "bg-gray-500/20"
                        : "bg-blue-500/20"
                }`}
              >
                <Ionicons
                  name={
                    item.status.toLowerCase() === "won" ||
                    item.status.toLowerCase() === "received"
                      ? "trophy"
                      : item.status.toLowerCase() === "lost" ||
                          item.status.toLowerCase() === "loss"
                        ? "sad"
                        : item.status.toLowerCase() === "cancelled"
                          ? "close-circle"
                          : "checkmark-circle"
                  }
                  size={20}
                  color={
                    item.status.toLowerCase() === "won" ||
                    item.status.toLowerCase() === "received"
                      ? "#22c55e"
                      : item.status.toLowerCase() === "lost" ||
                          item.status.toLowerCase() === "loss"
                        ? "#ef4444"
                        : item.status.toLowerCase() === "cancelled"
                          ? "#6b7280"
                          : "#3b82f6"
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
                <Text className="text-gray-400 text-xs">
                  {item.app} • {item.limit}
                </Text>
              </View>
            </View>

            <View className="items-end">
              <Text
                className={`font-bold text-base ${
                  item.status.toLowerCase() === "won" ||
                  item.status.toLowerCase() === "received"
                    ? "text-green-400"
                    : item.status.toLowerCase() === "lost" ||
                        item.status.toLowerCase() === "loss"
                      ? "text-red-400"
                      : "text-white"
                }`}
              >
                {item.status.toLowerCase() === "won" ||
                item.status.toLowerCase() === "received"
                  ? "+"
                  : item.status.toLowerCase() === "lost" ||
                      item.status.toLowerCase() === "loss"
                    ? "-"
                    : ""}
                {item.amount}
              </Text>
              <Text
                className={`text-xs capitalize ${getStatusColor(item.status)}`}
              >
                {item.status}
              </Text>
              <Text className="text-gray-500 text-xs">{item.date}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
