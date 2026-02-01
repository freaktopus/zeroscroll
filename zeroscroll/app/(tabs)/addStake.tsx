import React from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import CommitmentSetup from "@/components/Commitments/CommitmentSetup";

export default function AddStake() {
  const handleSuccess = () => {
    // Navigate back to home after successful creation
    router.replace("/(tabs)");
  };

  return (
    <ScrollView className="flex-1 bg-[#181A20]">
      <View className="p-5 pt-14">
        <Text className="text-white text-2xl font-bold mb-2">
          Create a Stake
        </Text>
        <Text className="text-gray-400 mb-4">
          Set a screen time limit and put money on the line!
        </Text>

        <CommitmentSetup onSuccess={handleSuccess} />

        {/* Info Card */}
        <View className="mt-4 bg-[#23242b] rounded-2xl p-5">
          <Text className="text-white font-semibold mb-3">How it works</Text>

          <InfoItem
            number="1"
            text="Set your daily screen time limit for an app"
          />
          <InfoItem
            number="2"
            text="Stake SOL - this will be locked in escrow"
          />
          <InfoItem
            number="3"
            text="If you stay under the limit, you keep your stake"
          />
          <InfoItem
            number="4"
            text="If you go over, your opponent wins the stake"
          />
        </View>

        {/* Spacer for bottom tab */}
        <View className="h-20" />
      </View>
    </ScrollView>
  );
}

function InfoItem({ number, text }: { number: string; text: string }) {
  return (
    <View className="flex-row items-start mb-3">
      <View className="w-6 h-6 rounded-full bg-blue-500/20 items-center justify-center mr-3">
        <Text className="text-blue-300 text-sm font-semibold">{number}</Text>
      </View>
      <Text className="text-gray-300 flex-1">{text}</Text>
    </View>
  );
}
