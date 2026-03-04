import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WalletInfo from "../../components/Commitments/WalletInfo";
import CommitmentHistory from "../../components/Commitments/CommitmentHistory";
import CurrentStatus from "@/components/Commitments/CurrentStatus";
import ScreenTimeDisplay from "@/components/ScreenTimeDisplay";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { api, formatSol, formatDate, shortenAddress } from "@/services/api";
import type { Commitment, BalanceResponse, CommitmentDisplay } from "@/types";
import { Ionicons } from "@expo/vector-icons";

export default function HomeScreen() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user, profile, walletAddress, logout: _logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      const [balanceData, commitmentsData] = await Promise.all([
        api.getBalance("SOL").catch(() => null),
        api.getCommitments(50, 0).catch(() => ({ commitments: [], total: 0 })),
      ]);

      if (balanceData) {
        setBalance(balanceData);
      }

      setCommitments(commitmentsData.commitments);
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchData();
    }
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Separate active and completed commitments
  const activeStatuses = ["pending", "locked", "active", "resolving"];
  const activeCommitments = commitments.filter((c) =>
    activeStatuses.includes(c.status),
  );
  const completedCommitments = commitments.filter(
    (c) => !activeStatuses.includes(c.status),
  );

  // Convert to display format
  const toDisplayFormat = (commitment: Commitment): CommitmentDisplay => {
    const isCreator = commitment.creator_id === user?.id;
    const appName = commitment.meta?.app_name || "N/A";
    const timeLimit = commitment.meta?.time_limit_minutes
      ? `${commitment.meta.time_limit_minutes}m/day`
      : "N/A";

    let displayStatus: string = commitment.status;
    if (commitment.status === "released") {
      displayStatus = commitment.winner_id === user?.id ? "Won" : "Lost";
    }

    return {
      id: commitment.id,
      user: commitment.title,
      app: appName,
      limit: timeLimit,
      amount: formatSol(commitment.amount),
      status: displayStatus,
      date: formatDate(commitment.created_at),
      isMyBet: isCreator,
    };
  };

  const currentStatusDisplay = activeCommitments.map(toDisplayFormat);
  const historyDisplay = completedCommitments.map(toDisplayFormat);

  const displayName =
    profile?.display_name ||
    profile?.username ||
    (walletAddress ? shortenAddress(walletAddress) : "User");
  const avatarLetter = displayName[0]?.toUpperCase() || "U";

  const handleAvatarPress = () => {
    router.push("/(tabs)/settings");
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#181A20]" edges={["bottom"]}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="text-gray-400 mt-4">Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#181A20]" edges={["bottom"]}>
      <ScrollView
        className="flex-1 px-5 pt-6 pb-8"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
            colors={["#3b82f6"]}
          />
        }
      >
        {/* Header */}
        <View className="mt-6 mb-2 flex-row justify-between items-center">
          <View>
            <Text className="text-gray-400 text-base">Welcome Back!</Text>
            <Text className="text-white text-2xl font-bold mb-2">
              {displayName}
            </Text>
          </View>

          {/* Avatar */}
          <Pressable onPress={handleAvatarPress} className="relative">
            <View className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-400/40 items-center justify-center">
              <Text className="text-blue-200 font-bold text-lg">
                {avatarLetter}
              </Text>
            </View>
            {!profile?.username && (
              <View className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full items-center justify-center">
                <Text className="text-xs">!</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Error Banner */}
        {error && (
          <View className="bg-red-500/10 border border-red-400/30 rounded-xl p-3 mb-4">
            <Text className="text-red-200 text-sm">{error}</Text>
            <Pressable onPress={fetchData} className="mt-2">
              <Text className="text-blue-300 text-sm">Tap to retry</Text>
            </Pressable>
          </View>
        )}

        {/* Wallet Summary */}
        <WalletInfo balance={balance} />

        {/* Screen Time Display */}
        <ScreenTimeDisplay />

        {/* Quick Actions */}
        <View className="flex-row gap-3 mb-4">
          <Pressable
            onPress={() => router.push("/(tabs)/addStake")}
            className="flex-1 bg-blue-500 rounded-xl py-3 flex-row items-center justify-center"
          >
            <Ionicons name="add" size={20} color="white" />
            <Text className="text-white font-semibold ml-2">New Stake</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(tabs)/leaderboard")}
            className="flex-1 bg-white/10 border border-white/20 rounded-xl py-3 flex-row items-center justify-center"
          >
            <Ionicons name="trophy" size={18} color="#fbbf24" />
            <Text className="text-white font-semibold ml-2">Leaderboard</Text>
          </Pressable>
        </View>

        {/* Current Active Stakes */}
        {activeCommitments.length > 0 ? (
          <CurrentStatus commitments={currentStatusDisplay} />
        ) : (
          <View className="bg-[#23242b] rounded-2xl p-5 mb-4">
            <Text className="text-gray-400 text-center">
              No active stakes. Create one to get started!
            </Text>
          </View>
        )}

        {/* Transaction History */}
        {completedCommitments.length > 0 ? (
          <CommitmentHistory commitments={historyDisplay} />
        ) : (
          <View className="mt-4">
            <Text className="text-gray-400 text-base mb-2">
              Transaction History
            </Text>
            <View className="bg-[#23242b] rounded-2xl p-5">
              <Text className="text-gray-500 text-center">
                No completed transactions yet
              </Text>
            </View>
          </View>
        )}

        {/* Spacer for bottom tab */}
        <View className="h-20" />
      </ScrollView>
    </SafeAreaView>
  );
}
