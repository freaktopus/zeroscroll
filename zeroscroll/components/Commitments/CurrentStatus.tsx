import React from "react";
import { View, Text } from "react-native";

interface Commitment {
  id: number;
  user: string;
  app: string;
  limit: string;
  amount: string;
  status: string;
  date: string;
}

interface CommitmentHistoryProps {
  commitments: Commitment[];
}

export default function CurrentStatus({ commitments }: CommitmentHistoryProps) {
  return (
    <View>
      <View className="mt-6 mb-2">
        <Text className="text-gray-400 text-base">Current Status</Text>
      </View>
      <View className="bg-[#23242b] rounded-2xl p-5 mb-5">
        {commitments.map((item) => (
          <View
            key={item.id}
            className="flex flex-row justify-between items-center border-b border-[#222] py-3"
          >
            <View className="flex flex-row items-center">
              <View className="bg-blue-400 w-9 h-9 rounded-full flex items-center justify-center">
                <Text className="text-white font-bold">{item.user[0]}</Text>
              </View>
              <View className="ml-3">
                <Text className="text-white font-bold text-base">
                  {item.user}
                </Text>
                <Text className="text-gray-400 text-xs">
                  {item.app} • {item.limit}
                </Text>
              </View>
            </View>
            <View className="flex flex-col items-end">
              <Text className="text-white font-bold text-base">
                {item.amount}
              </Text>
              <Text
                className={`font-bold text-xs mt-1 ${item.status === "Active" ? "text-blue-400" : "text-red-400"}`}
              >
                {item.status}
              </Text>
              <Text className="text-gray-500 text-xs mt-1">{item.date}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
