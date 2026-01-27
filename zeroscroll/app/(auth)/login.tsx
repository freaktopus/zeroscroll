import React, { useEffect, useState } from "react";
import { ScrollView, View, Text, Pressable } from "react-native";
import { useRouter, useNavigation } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BackHandler } from "react-native";
import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";

const STORAGE_KEY = "wallet_address";
const fakeTestnetAddress = () => "7pWqfY7oQK9mJx8gJd3V9u4v7YpZQmFQq1W9ZkTest";
const APP_IDENTITY = {
  name: "ZeroScroll",
  uri: "https://yourapp.com", // can be any stable URL you control
  icon: "favicon.ico", // resolves to https://yourapp.com/favicon.ico
};

export default function Login() {
  const router = useRouter();
  const navigation = useNavigation<any>();
  const [wallet, setWallet] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) setWallet(saved);
    })();
  }, []);

  const connectPhantom = async () => {
    // Opens a locally installed MWA wallet (Phantom) and asks user to approve.
    const authorizationResult = await transact(
      async (wallet: Web3MobileWallet) => {
        return await wallet.authorize({
          cluster: "solana:testnet",
          identity: APP_IDENTITY,
        });
      },
    );

    console.log("AUTH RESULT:", authorizationResult);

    const address = authorizationResult.accounts?.[0]?.address;
    if (!address) throw new Error("No account returned from wallet");

    await AsyncStorage.setItem(STORAGE_KEY, address);

    // go to tabs home
    router.replace("/(tabs)");
  };

  const logout = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setWallet(null);
    router.replace("/(auth)/login");
  };

  return (
    <View className="flex-1 bg-[#181A20] px-5 pb-6 pt-6 ">
      <View className="">
        <Text className="text-white text-3xl font-bold">Login</Text>
        <Text className="text-gray-400 mt-2">
          Connect Phantom (test wallet) to continue.
        </Text>
      </View>

      <View className="mt-6 bg-[#23242b] rounded-2xl p-5 border border-white/10">
        {wallet ? (
          <>
            <Text className="text-gray-400 text-xs">Connected</Text>
            <Text className="text-white mt-1" numberOfLines={1}>
              {wallet}
            </Text>

            <Pressable
              onPress={logout}
              className="mt-4 bg-red-500/20 border border-red-400/30 rounded-xl py-3"
            >
              <Text className="text-red-200 font-bold text-center">
                Disconnect
              </Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate("(tabs)")}
              className="mt-4 bg-blue-500 rounded-xl py-3"
            >
              <Text className="text-white font-bold text-center">Continue</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={connectPhantom}
            className="bg-blue-500 rounded-xl py-3"
          >
            <Text className="text-white font-bold text-center">
              Connect Phantom (Testnet)
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => navigation.navigate("register")}
          className="mt-4 py-2"
        >
          <Text className="text-gray-300 text-center">
            New here?{" "}
            <Text className="text-blue-300 font-semibold">Create account</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
