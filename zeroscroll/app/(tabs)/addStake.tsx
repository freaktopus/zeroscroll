import { Image } from "expo-image";
import React, { useState } from "react";
import { Text } from "react-native";
import { Platform, View, StyleSheet } from "react-native";

import { Link } from "expo-router";
import CommitmentSetup from "@/components/Commitments/CommitmentSetup";

const mockUsers = [
  { id: 1, name: "Alice", avatar: "A" },
  { id: 2, name: "Bob", avatar: "B" },
  { id: 3, name: "Charlie", avatar: "C" },
];

export default function addStake() {
  const [selectedUser, setSelectedUser] = useState(mockUsers[0]);
  return (
    <View className="p-2 mt-10">
      <Text className="text-white text-xl ml-2 font-bold mb-2">
        Set a Commitment
      </Text>
      <CommitmentSetup
        users={mockUsers}
        selectedUser={selectedUser}
        setSelectedUser={setSelectedUser}
        // appName={appName}
        // setAppName={setAppName}
        // screenTime={screenTime}
        // setScreenTime={setScreenTime}
        // amount={amount}
        // setAmount={setAmount}
      />
    </View>
  );
}
