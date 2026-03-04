import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";

export default function Login() {
  const router = useRouter();
  // using context to act as an global state for auth_status
  const { login, isAuthenticated, isLoading, user } = useAuth();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Root layout handles authenticated → tabs redirect
  useEffect(() => {
    if (isAuthenticated && user && !isLoading && !connecting) {
      console.log("[LOGIN] Already authenticated — root layout will redirect");
    }
  }, [isAuthenticated, isLoading, user, connecting]);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);

      const result = await login();
      setConnecting(false);

      if (result?.is_new) {
        router.replace("/(auth)/register");
      } else if (result && !result.is_new) {
        router.replace("/(tabs)");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to connect wallet");
      setConnecting(false);
      Alert.alert(
        "Connection Failed",
        err?.message || "Failed to connect wallet. Please try again.",
      );
    }
  };

  return (
    <View className="flex-1 bg-[#181A20] px-5 pb-6 pt-16">
      {/* Header */}
      <View className="items-center mb-8">
        <View className="w-20 h-20 rounded-full bg-blue-500/20 border-2 border-blue-400/40 items-center justify-center mb-4">
          <Image
            source={require("../../assets/images/icon.png")}
            style={{ width: 80, height: 80 }}
            resizeMode="contain"
          />
        </View>
        <Text className="text-white text-3xl font-bold">ZeroScroll</Text>
        <Text className="text-gray-400 mt-2 text-center">
          Connect your Solana wallet to get started
        </Text>
      </View>

      {/* Connection Card */}
      <View className="bg-[#23242b] rounded-2xl p-5 border border-white/10">
        {connecting ? (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text className="text-gray-400 mt-4">Connecting wallet...</Text>
          </View>
        ) : (
          <>
            <Text className="text-white text-lg font-semibold mb-2">
              Wallet Authentication
            </Text>
            <Text className="text-gray-400 text-sm mb-6">
              Connect your Phantom or other Solana wallet to sign in securely.
              Your identity is verified through a cryptographic signature.
            </Text>

            {error && (
              <View className="bg-red-500/10 border border-red-400/30 rounded-xl p-3 mb-4">
                <Text className="text-red-200 text-sm">{error}</Text>
              </View>
            )}

            <Pressable
              onPress={handleConnect}
              className="bg-blue-500 rounded-xl py-4 flex-row items-center justify-center"
            >
              <Ionicons name="wallet" size={20} color="white" />
              <Text className="text-white font-bold text-base ml-2">
                Connect Wallet
              </Text>
            </Pressable>

            {/* Info */}
            <View className="mt-6 space-y-3">
              <InfoRow
                icon="shield-checkmark"
                text="Secure signature-based authentication"
              />
              <InfoRow
                icon="key"
                text="Your private keys never leave your wallet"
              />
              <InfoRow
                icon="flash"
                text="Works with Phantom, Solflare & more"
              />
            </View>
          </>
        )}
      </View>

      {/* Footer */}
      <View className="mt-auto">
        <Text className="text-gray-500 text-center text-xs">
          By connecting, you agree to our Terms of Service
        </Text>
      </View>
    </View>
  );
}

function InfoRow({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View className="flex-row items-center mt-3">
      <Ionicons name={icon} size={18} color="#6b7280" />
      <Text className="text-gray-400 text-sm ml-3">{text}</Text>
    </View>
  );
}
