import React from "react";
import { View, Text, ScrollView } from "react-native";

// Mock data for demonstration
const today = {
  balance: "2.10 SOL",
  stakeLoss: "-0.10 SOL",
  stakeReceived: "+0.20 SOL",
  totalCommitment: "0.30 SOL",
};
const inDepth = {
  balance: "2.50 SOL",
  stakeLoss: "-0.40 SOL",
  stakeReceived: "+0.60 SOL",
  totalCommitment: "1.00 SOL",
};
const total = {
  balance: "3.00 SOL",
  stakeLoss: "-1.00 SOL",
  stakeReceived: "+2.00 SOL",
  totalCommitment: "3.00 SOL",
};

function ContextCard({ title, data }: { title: string; data: any }) {
  return (
    <View className="bg-[#23242b] rounded-2xl p-5 mb-5">
      <Text className="text-white text-lg font-bold mb-2">{title}</Text>
      <View className="flex flex-row justify-between items-center mb-1">
        <Text className="text-gray-400 text-base">Total Balance</Text>
        <Text className="text-white text-lg font-bold">{data.balance}</Text>
      </View>
      <View className="flex flex-row justify-between items-center mb-1">
        <Text className="text-gray-400 text-base">Stake Loss</Text>
        <Text className="text-red-400 text-lg font-bold">{data.stakeLoss}</Text>
      </View>
      <View className="flex flex-row justify-between items-center mb-1">
        <Text className="text-gray-400 text-base">Stake Received</Text>
        <Text className="text-green-400 text-lg font-bold">
          {data.stakeReceived}
        </Text>
      </View>
      <View className="flex flex-row justify-between items-center mb-1">
        <Text className="text-gray-400 text-base">Total Commitment</Text>
        <Text className="text-blue-400 text-lg font-bold">
          {data.totalCommitment}
        </Text>
      </View>
    </View>
  );
}

export default function TransactionsScreen() {
  return (
    <ScrollView className="flex-1 bg-[#181A20] px-5 pt-6 pb-8">
      <ContextCard title="Today" data={today} />
      <ContextCard title="In Depth" data={inDepth} />
      <ContextCard title="Total" data={total} />
    </ScrollView>
  );
}
