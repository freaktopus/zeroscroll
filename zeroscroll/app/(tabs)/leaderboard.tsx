import React, { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { api, shortenAddress, formatSol } from "@/services/api";
import type { LeaderboardEntry } from "@/types";

// Mock leaderboard data - in production, this would come from the API
const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  {
    rank: 1,
    user_id: "1",
    username: "cryptoking",
    display_name: "Crypto King",
    avatar_url: null,
    wallet_pubkey: "7pWqfY7oQK9mJx8gJd3V9u4v7YpZQmFQq1W9Zk123",
    total_wins: 24,
    total_amount_won: 12500000000,
    win_streak: 8,
  },
  {
    rank: 2,
    user_id: "2",
    username: "focusmaster",
    display_name: "Focus Master",
    avatar_url: null,
    wallet_pubkey: "8aKxYp3mQ2tV7wRk1Zc8LmTestPhantomWallet456",
    total_wins: 21,
    total_amount_won: 9800000000,
    win_streak: 5,
  },
  {
    rank: 3,
    user_id: "3",
    username: "nodistractions",
    display_name: "No Distractions",
    avatar_url: null,
    wallet_pubkey: "9bLyZq4nR3uW8xSl2Ad9NnTestPhantomWallet789",
    total_wins: 18,
    total_amount_won: 7200000000,
    win_streak: 3,
  },
  {
    rank: 4,
    user_id: "4",
    username: "screentime_pro",
    display_name: "Screen Time Pro",
    avatar_url: null,
    wallet_pubkey: "AcMzAr5oS4vX9yTm3Be0OoTestPhantomWalletABC",
    total_wins: 15,
    total_amount_won: 5500000000,
    win_streak: 2,
  },
  {
    rank: 5,
    user_id: "5",
    username: "disciplined",
    display_name: "The Disciplined",
    avatar_url: null,
    wallet_pubkey: "BdNaBs6pT5wY0zUn4Cf1PpTestPhantomWalletDEF",
    total_wins: 12,
    total_amount_won: 4200000000,
    win_streak: 1,
  },
];

export default function Leaderboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [timeframe, setTimeframe] = useState<"week" | "month" | "all">("week");

  const fetchLeaderboard = useCallback(async () => {
    try {
      // Try to fetch from API, fallback to mock data
      let data;
      try {
        data = await api.getLeaderboard(timeframe);
        // Filter to only show registered users (those with user_id)
        data = data.filter((entry: LeaderboardEntry) => entry.user_id);
      } catch {
        console.log("API not available, using mock data");
        // Use mock data and filter to only registered users
        data = MOCK_LEADERBOARD.filter((entry) => entry.user_id);
      }

      // Ensure we have proper ranking
      data = data.map((entry: LeaderboardEntry, index: number) => ({
        ...entry,
        rank: index + 1,
      }));

      setLeaderboard(data);
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
      setLeaderboard([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  if (loading) {
    return (
      <View className="flex-1 bg-[#181A20] items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-[#181A20]"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#3b82f6"
          colors={["#3b82f6"]}
        />
      }
    >
      <View className="p-5 pt-14">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-white text-2xl font-bold">Leaderboard</Text>
          <View className="flex-row items-center">
            <Ionicons name="trophy" size={24} color="#fbbf24" />
          </View>
        </View>

        {/* Timeframe Selector */}
        <View className="flex-row bg-[#23242b] rounded-xl p-1 mb-6">
          {(["week", "month", "all"] as const).map((tf) => (
            <Pressable
              key={tf}
              onPress={() => setTimeframe(tf)}
              className={`flex-1 py-2 rounded-lg ${
                timeframe === tf ? "bg-blue-500" : ""
              }`}
            >
              <Text
                className={`text-center font-semibold ${
                  timeframe === tf ? "text-white" : "text-gray-400"
                }`}
              >
                {tf === "week" ? "Week" : tf === "month" ? "Month" : "All Time"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Top 3 Podium */}
        {leaderboard.length > 0 && (
          <View
            className="flex-row justify-center items-end mb-6 mt-4"
            style={{ height: 200 }}
          >
            {/* 2nd Place */}
            {leaderboard[1] && (
              <PodiumItem entry={leaderboard[1]} position={2} />
            )}

            {/* 1st Place */}
            {leaderboard[0] && (
              <PodiumItem entry={leaderboard[0]} position={1} />
            )}

            {/* 3rd Place */}
            {leaderboard[2] && (
              <PodiumItem entry={leaderboard[2]} position={3} />
            )}
          </View>
        )}

        {/* Rest of Leaderboard */}
        <View className="bg-[#23242b] rounded-2xl overflow-hidden">
          {leaderboard.slice(3).map((entry, index) => (
            <LeaderboardRow
              key={entry.user_id}
              entry={entry}
              isCurrentUser={entry.user_id === user?.id}
            />
          ))}

          {leaderboard.length <= 3 && (
            <View className="p-8 items-center">
              <Text className="text-gray-400">More players coming soon!</Text>
            </View>
          )}
        </View>

        {/* Your Ranking (if not in top) */}
        {user && !leaderboard.find((e) => e.user_id === user.id) && (
          <View className="mt-4 bg-blue-500/10 border border-blue-400/20 rounded-2xl p-4">
            <Text className="text-blue-200 text-center">
              Win more stakes to appear on the leaderboard!
            </Text>
          </View>
        )}

        {/* Spacer */}
        <View className="h-20" />
      </View>
    </ScrollView>
  );
}

function PodiumItem({
  entry,
  position,
}: {
  entry: LeaderboardEntry;
  position: 1 | 2 | 3;
}) {
  const heights = { 1: 80, 2: 56, 3: 44 };
  const colors = {
    1: {
      bg: "bg-yellow-500/20",
      border: "border-yellow-400",
      text: "text-yellow-400",
    },
    2: {
      bg: "bg-gray-400/20",
      border: "border-gray-400",
      text: "text-gray-400",
    },
    3: {
      bg: "bg-orange-500/20",
      border: "border-orange-400",
      text: "text-orange-400",
    },
  };

  const displayName =
    entry.display_name || entry.username || shortenAddress(entry.wallet_pubkey);
  const avatarLetter = displayName[0]?.toUpperCase() || "?";

  return (
    <View
      className={`items-center mx-1 flex-1 max-w-[110px]`}
      style={{ zIndex: position === 1 ? 2 : 1 }}
    >
      {/* Crown for 1st */}
      {position === 1 && (
        <Ionicons
          name="trophy"
          size={24}
          color="#fbbf24"
          style={{ marginBottom: 2 }}
        />
      )}

      {/* Avatar */}
      <View
        className={`w-12 h-12 rounded-full ${colors[position].bg} border-2 ${colors[position].border} items-center justify-center`}
      >
        <Text className={`font-bold text-lg ${colors[position].text}`}>
          {avatarLetter}
        </Text>
      </View>

      {/* Name */}
      <Text
        className="text-white font-semibold mt-1 text-center text-xs"
        numberOfLines={1}
      >
        {displayName.length > 8 ? displayName.slice(0, 8) + "..." : displayName}
      </Text>

      {/* Wins */}
      <Text className={`text-xs ${colors[position].text}`}>
        {entry.total_wins}w
      </Text>

      {/* Podium */}
      <View
        className={`w-full ${colors[position].bg} rounded-t-xl mt-1 items-center justify-center`}
        style={{ height: heights[position] }}
      >
        <Text className={`text-xl font-bold ${colors[position].text}`}>
          {position}
        </Text>
      </View>
    </View>
  );
}

function LeaderboardRow({
  entry,
  isCurrentUser,
}: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
}) {
  const displayName =
    entry.display_name || entry.username || shortenAddress(entry.wallet_pubkey);
  const avatarLetter = displayName[0]?.toUpperCase() || "?";

  return (
    <View
      className={`flex-row items-center p-4 border-b border-white/5 ${isCurrentUser ? "bg-blue-500/10" : ""}`}
    >
      {/* Rank */}
      <View className="w-8">
        <Text className="text-gray-400 font-semibold">{entry.rank}</Text>
      </View>

      {/* Avatar */}
      <View className="w-10 h-10 rounded-full bg-white/10 items-center justify-center">
        <Text className="text-white font-semibold">{avatarLetter}</Text>
      </View>

      {/* Name & Stats */}
      <View className="flex-1 ml-3">
        <View className="flex-row items-center">
          <Text className="text-white font-semibold">{displayName}</Text>
          {isCurrentUser && (
            <View className="ml-2 bg-blue-500/20 px-2 py-0.5 rounded">
              <Text className="text-blue-300 text-xs">You</Text>
            </View>
          )}
        </View>
        <Text className="text-gray-400 text-sm">
          {entry.total_wins} wins • {entry.win_streak} streak
        </Text>
      </View>

      {/* Amount Won */}
      <View className="items-end">
        <Text className="text-green-400 font-semibold">
          +{formatSol(entry.total_amount_won)}
        </Text>
      </View>
    </View>
  );
}
