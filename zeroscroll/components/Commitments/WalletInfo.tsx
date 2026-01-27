import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

interface TodayWalletProps {
  totalBalance: string;
  stakeLoss: string;
  stakeReceived: string;
  totalCommitment: string;
}

export default function TodayWalletSummary({
  totalBalance,
  stakeLoss,
  stakeReceived,
  totalCommitment,
}: TodayWalletProps) {
  const navigation = useNavigation();

  return (
    <Pressable
      onPress={() => navigation.navigate("stake_details" as never)}
      className="bg-[#23242b] rounded-3xl p-5 mb-5"
      style={{
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
      }}
    >
      {/* Header */}
      <View className="flex-row justify-between">
        <Text className="text-white text-right text-lg font-semibold">
          Today Summary
        </Text>
      </View>

      <View className="h-[1px] bg-white/10 my-3" />
      {/* Main Balance */}
      <View className="">
        <Text className="text-gray-400 text-xs">Total Balance</Text>
        <Text className="text-white text-3xl font-bold mt-1">${"1940"}</Text>
      </View>

      {/* Divider */}
      <View className="h-[1px] bg-white/10 my-3" />
      <View className="flex-row h-auto justify-between">
        {/* Stats */}
        <StatCol
          label="Stake Loss"
          value={"1000"}
          icon="trending-down"
          iconBg="bg-red-500/15"
          iconColor="#ef4444"
          valueColor="text-red-300"
        />

        <StatCol
          label="Stake Received"
          value={"980"}
          icon="trending-up"
          iconBg="bg-green-500/15"
          iconColor="#22c55e"
          valueColor="text-green-300"
        />

        <StatCol
          label="Total Commitment"
          value={"500"}
          icon="lock-closed"
          iconBg="bg-blue-500/15"
          iconColor="#3b82f6"
        />
      </View>
    </Pressable>
  );
}

function StatCol({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  valueColor = "text-white",
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  valueColor?: string;
}) {
  return (
    <View className="flex-col items-center">
      {/* Icon and label */}
      <View className="flex-col items-center">
        <View
          className={`w-9 h-9 rounded-full items-center justify-center ${iconBg}`}
        >
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
        <Text className="mt-1 text-gray-300 text-sm">{label}</Text>
      </View>
      {/* Value */}
      <Text className={`text-base font-semibold ${valueColor}`}>{value}</Text>
    </View>
  );
}
