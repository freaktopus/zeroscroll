import React, { useMemo, useRef, useState } from "react";
import { View, Pressable, Text, TextInput, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MinuteScroller from "../ui/minutes";

interface User {
  id: number;
  name: string;
  avatar: string;
}

const FAKE_USERS: User[] = [
  { id: 1, name: "Mandira", avatar: "M" },
  { id: 2, name: "Dikshya", avatar: "D" },
  { id: 3, name: "Utkrist", avatar: "U" },
  { id: 4, name: "Sushan", avatar: "S" },
  { id: 5, name: "Bipul", avatar: "B" },
];

const APP_OPTIONS = [
  { key: "Facebook", icon: "logo-facebook" as const },
  { key: "TikTok", icon: "logo-tiktok" as const },
  { key: "X", icon: "logo-twitter" as const }, // closest in Ionicons
  { key: "Instagram", icon: "logo-instagram" as const },
];

export default function CommitmentSetup() {
  const users = FAKE_USERS;

  const [userQuery, setUserQuery] = useState("");
  const [appName, setAppName] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [amount, setAmount] = useState("");

  const matchedUser = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return null;
    return users.find((u) => u.name.toLowerCase() === q) ?? null;
  }, [userQuery, users]);

  const canCreate =
    !!matchedUser &&
    !!appName &&
    minutes > 0 &&
    !!amount &&
    !Number.isNaN(Number(amount));

  return (
    <View className="bg-[#23242b] rounded-2xl p-5">
      {/* Select the user */}
      <Text className="text-gray-400 text-sm mb-2">Select the User</Text>

      <View className="relative">
        <TextInput
          className="bg-[#23242b] border border-[#333] rounded-xl text-white pl-3 pr-10 py-3 text-base w-full"
          placeholder="Type username (e.g. Mandira)"
          placeholderTextColor="#888"
          value={userQuery}
          onChangeText={setUserQuery}
          autoCapitalize="words"
        />

        {/* ✅ verification tick inside input */}
        <View className="absolute right-3 top-3.5">
          {matchedUser ? (
            <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
          ) : userQuery.trim().length > 0 ? (
            <Ionicons name="close-circle" size={20} color="#ef4444" />
          ) : null}
        </View>
      </View>

      {/* Small helper */}
      <Text className="text-gray-500 text-xs mt-2">
        {matchedUser
          ? `Verified: ${matchedUser.name}`
          : "Type an exact name from the user list"}
      </Text>

      {/* App selection */}
      <Text className="text-gray-400 text-sm mt-5 mb-2">App Name</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-row"
      >
        {APP_OPTIONS.map((app) => {
          const active = appName === app.key;
          return (
            <Pressable
              key={app.key}
              onPress={() => setAppName(app.key)}
              className={`mr-2 flex-row items-center px-4 py-3 rounded-xl border ${
                active
                  ? "bg-blue-500/15 border-blue-400"
                  : "bg-[#23242b] border-[#333]"
              }`}
            >
              <Ionicons
                name={app.icon}
                size={16}
                color={active ? "#93c5fd" : "#9ca3af"}
                style={{ marginRight: 8 }}
              />
              <Text
                className={`${active ? "text-blue-200" : "text-white"} font-semibold`}
              >
                {app.key}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Minutes scroller */}
      <MinuteScroller minutes={minutes} setMinutes={setMinutes} />

      {/* Amount */}
      <Text className="text-gray-400 text-sm mt-5 mb-2">Amount (SOL)</Text>
      <TextInput
        className="bg-[#23242b] border border-[#333] rounded-xl text-white px-3 py-3 text-base w-full"
        placeholder="e.g. 0.5"
        placeholderTextColor="#888"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />

      {/* Create */}
      <Pressable
        disabled={!canCreate}
        className={`rounded-xl py-3 w-full mt-5 ${
          canCreate ? "bg-blue-500" : "bg-blue-500/30"
        }`}
        onPress={() => {
          // create commitment
          // matchedUser is verified, appName selected, minutes set, amount provided
        }}
      >
        <Text className="text-white font-bold text-base text-center">
          Create Commitment
        </Text>
      </Pressable>
    </View>
  );
}
