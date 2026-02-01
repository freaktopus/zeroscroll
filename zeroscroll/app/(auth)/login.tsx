import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { shortenAddress } from "@/services/api";
import { Ionicons } from "@expo/vector-icons";

export default function Login() {
  const router = useRouter();
  const {
    login,
    logout,
    isAuthenticated,
    isLoading,
    user,
    profile,
    walletAddress,
  } = useAuth();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-navigate when authenticated (handles case where transact() doesn't return)
  useEffect(() => {
    console.log(
      "[LOGIN] useEffect - isAuthenticated:",
      isAuthenticated,
      "isLoading:",
      isLoading,
      "user:",
      !!user,
      "connecting:",
      connecting,
    );
    if (isAuthenticated && user && !isLoading && !connecting) {
      console.log("[LOGIN] Auto-navigating because authenticated!");
      // Small delay to ensure state is fully propagated
      setTimeout(() => {
        if (!profile?.username) {
          console.log("[LOGIN] No username - going to register");
          router.replace("/(auth)/register");
        } else {
          console.log("[LOGIN] Has username - going to tabs");
          router.replace("/(tabs)");
        }
      }, 100);
    }
  }, [isAuthenticated, isLoading, user, profile, router, connecting]);

  const handleConnect = async () => {
    try {
      console.log("[LOGIN] 1. Starting connection...");
      setConnecting(true);
      setError(null);

      console.log("[LOGIN] 2. Calling login()...");
      const result = await login();
      console.log("[LOGIN] 3. Login result:", result ? "SUCCESS" : "NULL");

      if (result) {
        console.log("[LOGIN] 4. is_new:", result.is_new);
        if (result.is_new) {
          // New user, go to register to set username
          console.log("[LOGIN] 5. Navigating to register...");
          router.replace("/(auth)/register");
        } else {
          // Existing user, go to main app
          console.log("[LOGIN] 5. Navigating to tabs...");
          router.replace("/(tabs)");
        }
      } else {
        console.log(
          "[LOGIN] 4. No result returned from login - waiting for useEffect to handle navigation",
        );
      }
    } catch (err: any) {
      console.error("[LOGIN] ERROR:", err);
      console.error("[LOGIN] Error message:", err.message);
      console.error("[LOGIN] Error stack:", err.stack);
      setError(err.message || "Failed to connect wallet");
      Alert.alert(
        "Connection Failed",
        err.message || "Failed to connect wallet",
      );
    } finally {
      console.log("[LOGIN] 6. Finally block - setting connecting=false");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await logout();
      setError(null);
    } catch (err: any) {
      console.error("Disconnect error:", err);
    }
  };

  const handleContinue = () => {
    if (!profile?.username) {
      // No username set, go to register
      router.replace("/(auth)/register");
    } else {
      router.replace("/(tabs)");
    }
  };

  const displayName =
    profile?.display_name ||
    profile?.username ||
    (walletAddress ? shortenAddress(walletAddress) : "Unknown");

  return (
    <View className="flex-1 bg-[#181A20] px-5 pb-6 pt-16">
      {/* Header */}
      <View className="items-center mb-8">
        <View className="w-20 h-20 rounded-full bg-blue-500/20 border-2 border-blue-400/40 items-center justify-center mb-4">
          <Ionicons name="wallet-outline" size={40} color="#60a5fa" />
        </View>
        <Text className="text-white text-3xl font-bold">ZeroScroll</Text>
        <Text className="text-gray-400 mt-2 text-center">
          Connect your Solana wallet to get started
        </Text>
      </View>

      {/* Connection Card */}
      <View className="bg-[#23242b] rounded-2xl p-5 border border-white/10">
        {isLoading || connecting ? (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text className="text-gray-400 mt-4">
              {connecting ? "Connecting wallet..." : "Loading..."}
            </Text>
          </View>
        ) : isAuthenticated && user ? (
          <>
            {/* Connected State */}
            <View className="flex-row items-center mb-4">
              <View className="w-12 h-12 rounded-full bg-green-500/20 border border-green-400/40 items-center justify-center">
                <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-gray-400 text-xs">Connected</Text>
                <Text className="text-white font-semibold">{displayName}</Text>
              </View>
            </View>

            {/* Wallet Address */}
            <View className="bg-white/5 rounded-xl p-3 mb-4">
              <Text className="text-gray-400 text-xs mb-1">Wallet Address</Text>
              <Text className="text-white text-sm" numberOfLines={1}>
                {walletAddress || user.wallet_pubkey}
              </Text>
            </View>

            {/* Username Status */}
            {!profile?.username && (
              <View className="bg-yellow-500/10 border border-yellow-400/30 rounded-xl p-3 mb-4">
                <View className="flex-row items-center">
                  <Ionicons name="warning" size={20} color="#eab308" />
                  <Text className="text-yellow-200 ml-2 flex-1">
                    Set a username to complete your profile
                  </Text>
                </View>
              </View>
            )}

            {/* Actions */}
            <Pressable
              onPress={handleContinue}
              className="bg-blue-500 rounded-xl py-4 mb-3"
            >
              <Text className="text-white font-bold text-center text-base">
                {profile?.username ? "Continue to App" : "Set Username"}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleDisconnect}
              className="bg-red-500/20 border border-red-400/30 rounded-xl py-3"
            >
              <Text className="text-red-200 font-semibold text-center">
                Disconnect Wallet
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            {/* Not Connected State */}
            <Text className="text-white text-lg font-semibold mb-2">
              Wallet Authentication
            </Text>
            <Text className="text-gray-400 text-sm mb-6">
              Connect your Phantom or other Solana wallet to sign in securely.
              We will verify your identity through a cryptographic signature.
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
      <View className="mt-auto pt-6">
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
