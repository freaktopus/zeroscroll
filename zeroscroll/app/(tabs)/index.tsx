import React, { useEffect, useState } from "react";
import { ScrollView, View, Text, Pressable } from "react-native";
import WalletInfo from "../../components/Commitments/WalletInfo";
import CommitmentSetup from "../../components/Commitments/CommitmentSetup";
import CommitmentHistory from "../../components/Commitments/CommitmentHistory";
import CurrentStatus from "@/components/Commitments/CurrentStatus";
import { router, useNavigation } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const mockUsers = [
  { id: 1, name: "Alice", avatar: "A" },
  { id: 2, name: "Bob", avatar: "B" },
  { id: 3, name: "Charlie", avatar: "C" },
];

const currentStatus = [
  {
    id: 1,
    user: "Alice",
    app: "Instagram",
    limit: "1h/day",
    amount: "0.5 SOL",
    status: "Someone Betting",
    date: "02 Oct 2024",
  },
  {
    id: 2,
    user: "Bob",
    app: "YouTube",
    limit: "30m/day",
    amount: "0.2 SOL",
    status: "Your Bet",
    date: "28 Sep 2024",
  },
];
const mockCommitments = [
  {
    id: 1,
    user: "Alice",
    app: "Instagram",
    limit: "1h/day",
    amount: "0.5 SOL",
    status: "Safe",
    date: "02 Oct 2024",
  },
  {
    id: 2,
    user: "Bob",
    app: "YouTube",
    limit: "30m/day",
    amount: "0.2 SOL",
    status: "Loss",
    date: "28 Sep 2024",
  },
  {
    id: 3,
    user: "Bob",
    app: "YouTube",
    limit: "30m/day",
    amount: "0.2 SOL",
    status: "Received",
    date: "28 Sep 2024",
  },
];

const STORAGE_KEY = "wallet_address";
const fakeTestnetAddress = () => "7pWqfY7oQK9mJx8gJd3V9u4v7YpZQmFQq1W9ZkTest";

export default function Recents() {
  const [selectedUser, setSelectedUser] = useState(mockUsers[0]);
  const navigation = useNavigation<any>();

  const clickAvatar = () => {
    navigation.getParent()?.navigate("(auth)", { screen: "login" });
  };

  return (
    <ScrollView className="flex-1 bg-[#181A20] px-5 pt-6 pb-8">
      <View className="mt-6 mb-2 flex-row justify-between">
        <View className="">
          <Text className="text-gray-400 text-base">Welcome Back!</Text>
          <Text className="text-white text-2xl font-bold mb-2">
            {selectedUser.name}
          </Text>
        </View>
        {/* Avatar (logged-in user) */}
        <Pressable onPress={clickAvatar} className="relative">
          <View className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-400/40 items-center justify-center">
            <Text className="text-blue-200 font-bold text-lg">
              {selectedUser.avatar}
            </Text>
          </View>
        </Pressable>
      </View>
      <WalletInfo />

      <CurrentStatus commitments={currentStatus} />
      <CommitmentHistory commitments={mockCommitments} />
    </ScrollView>
  );
}

// ...existing code...
