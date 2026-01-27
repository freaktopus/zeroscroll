import React, { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
// import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "wallet_address";
const fakeTestnetAddress = () => "9aKxYp3mQ2tV7wRk1Zc8LmTestPhantomWallet";

export default function Register() {
  const navigation = useNavigation<any>();
  const [username, setUsername] = useState("");
  const [wallet, setWallet] = useState<string | null>(null);

  const connectMock = async () => {
    const addr = fakeTestnetAddress();
    // await AsyncStorage.setItem(STORAGE_KEY, addr);
    setWallet(addr);
  };

  const createAccount = async () => {
    if (!wallet) await connectMock();
    navigation.getParent()?.navigate("(tabs)", { screen: "index" });
  };

  return (
    <View className="flex-1 bg-[#181A20] px-5 mt-16">
      <Text className="text-white text-3xl font-bold">Register</Text>
      <Text className="text-gray-400 mt-2">
        Create account to start your journey.
      </Text>

      <View className="mt-6 bg-[#23242b] rounded-2xl p-5 border border-white/10">
        <Text className="text-gray-300 text-sm mb-2">Username</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="e.g. sannux"
          placeholderTextColor="#7b7f8a"
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
        />

        <Text className="text-gray-300 text-sm mt-5 mb-2">Wallet</Text>
        {wallet ? (
          <View className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <Text className="text-gray-400 text-xs">Connected</Text>
            <Text className="text-white mt-1" numberOfLines={1}>
              {wallet}
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={connectMock}
            className="bg-blue-500 rounded-xl py-3"
          >
            <Text className="text-white font-bold text-center">
              Connect Phantom (Testnet)
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={createAccount}
          className="mt-6 bg-green-500 rounded-xl py-3"
        >
          <Text className="text-white font-bold text-center">
            Create Account
          </Text>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate("login")}
          className="mt-4 py-2"
        >
          <Text className="text-gray-300 text-center">
            Already have an account?{" "}
            <Text className="text-blue-300 font-semibold">Login</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
