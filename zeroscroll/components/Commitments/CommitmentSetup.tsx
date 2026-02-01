import React, { useMemo, useState } from "react";
import {
  View,
  Pressable,
  Text,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MinuteScroller from "../ui/minutes";
import { api, solToLamports } from "@/services/api";
import type { CreateCommitmentRequest, UserWithProfile } from "@/types";
import debounce from "@/utils/debounce";
import { useAuth } from "@/context/AuthContext";

// App options with Android package names for screen time tracking
const APP_OPTIONS = [
  {
    key: "Instagram",
    icon: "logo-instagram" as const,
    packageName: "com.instagram.android",
  },
  {
    key: "TikTok",
    icon: "logo-tiktok" as const,
    packageName: "com.zhiliaoapp.musically",
  },
  {
    key: "YouTube",
    icon: "logo-youtube" as const,
    packageName: "com.google.android.youtube",
  },
  {
    key: "Twitter",
    icon: "logo-twitter" as const,
    packageName: "com.twitter.android",
  },
  {
    key: "Facebook",
    icon: "logo-facebook" as const,
    packageName: "com.facebook.katana",
  },
  {
    key: "Snapchat",
    icon: "camera" as const,
    packageName: "com.snapchat.android",
  },
  {
    key: "Reddit",
    icon: "logo-reddit" as const,
    packageName: "com.reddit.frontpage",
  },
  { key: "Discord", icon: "chatbubbles" as const, packageName: "com.discord" },
];

interface CommitmentSetupProps {
  onSuccess?: () => void;
}

export default function CommitmentSetup({ onSuccess }: CommitmentSetupProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [opponentWallet, setOpponentWallet] = useState("");
  const [appName, setAppName] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState(7); // days
  const [isSoloStake, setIsSoloStake] = useState(true); // Default to solo stake

  const [loading, setLoading] = useState(false);
  const [opponentUser, setOpponentUser] = useState<UserWithProfile | null>(
    null,
  );
  const [checkingOpponent, setCheckingOpponent] = useState(false);

  // Check opponent by username or wallet
  const checkOpponent = useMemo(
    () =>
      debounce(async (input: string) => {
        if (!input || input.length < 3) {
          setOpponentUser(null);
          setCheckingOpponent(false);
          return;
        }

        try {
          setCheckingOpponent(true);

          // Try by username first
          let user = await api.getUserByUsername(input);

          // If not found, try by wallet address
          if (!user && input.length > 30) {
            user = await api.getUserByWallet(input);
          }

          setOpponentUser(user);
        } catch (err) {
          console.error("Error checking opponent:", err);
          setOpponentUser(null);
        } finally {
          setCheckingOpponent(false);
        }
      }, 500),
    [],
  );

  const handleOpponentChange = (text: string) => {
    setOpponentWallet(text);
    checkOpponent(text);
  };

  const canCreate =
    title.trim().length >= 3 &&
    appName &&
    minutes > 0 &&
    amount &&
    !isNaN(Number(amount)) &&
    Number(amount) > 0;

  const handleCreate = async () => {
    if (!canCreate) return;

    if (!user) {
      Alert.alert(
        "Authentication Required",
        "Please log in to create a stake.",
      );
      return;
    }

    try {
      setLoading(true);

      const now = new Date();
      const startAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now
      const endAt = new Date(
        startAt.getTime() + duration * 24 * 60 * 60 * 1000,
      );

      // Find the selected app to get its package name
      const selectedApp = APP_OPTIONS.find((app) => app.key === appName);

      const request: CreateCommitmentRequest = {
        kind: "screen_time_bet",
        title: title.trim(),
        description: description.trim() || undefined,
        amount: solToLamports(Number(amount)),
        currency: "SOL",
        // Only set opponent if not a solo stake AND user provided one
        opponent_wallet: isSoloStake
          ? undefined
          : opponentUser?.user.wallet_pubkey ||
            (opponentWallet.length > 30 ? opponentWallet : undefined),
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        meta: {
          app_name: appName,
          app_package_name: selectedApp?.packageName,
          time_limit_minutes: minutes,
          is_solo: isSoloStake,
        },
      };

      const commitment = await api.createCommitment(request);

      const successMessage = isSoloStake
        ? `Your solo stake "${commitment.title}" is now active! Stay under ${minutes} minutes on ${appName} to win.`
        : `Your stake "${commitment.title}" has been created. Waiting for opponent to join.`;

      Alert.alert("Stake Created!", successMessage, [
        {
          text: "OK",
          onPress: () => {
            // Reset form
            setTitle("");
            setDescription("");
            setOpponentWallet("");
            setAppName("");
            setMinutes(60);
            setAmount("");
            setOpponentUser(null);
            setIsSoloStake(true);
            onSuccess?.();
          },
        },
      ]);
    } catch (err: any) {
      console.error("Error creating commitment:", err);
      Alert.alert("Error", err.message || "Failed to create stake");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="bg-[#23242b] rounded-2xl p-5">
      {/* Stake Type Toggle */}
      <Text className="text-gray-400 text-sm mb-2">Stake Type</Text>
      <View className="flex-row mb-4">
        <Pressable
          onPress={() => setIsSoloStake(true)}
          className={`flex-1 py-3 rounded-l-xl border ${
            isSoloStake
              ? "bg-blue-500 border-blue-500"
              : "bg-white/5 border-white/10"
          }`}
        >
          <Text
            className={`text-center font-semibold ${
              isSoloStake ? "text-white" : "text-gray-400"
            }`}
          >
            Solo Stake
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setIsSoloStake(false)}
          className={`flex-1 py-3 rounded-r-xl border ${
            !isSoloStake
              ? "bg-blue-500 border-blue-500"
              : "bg-white/5 border-white/10"
          }`}
        >
          <Text
            className={`text-center font-semibold ${
              !isSoloStake ? "text-white" : "text-gray-400"
            }`}
          >
            Challenge
          </Text>
        </Pressable>
      </View>

      {isSoloStake && (
        <View className="bg-blue-500/10 border border-blue-400/30 rounded-xl p-3 mb-4">
          <Text className="text-blue-200 text-xs">
            💡 Solo Stake: Bet against yourself! If you stay under the time
            limit, you win and get your stake back. If you go over, you lose
            your stake.
          </Text>
        </View>
      )}

      {/* Title */}
      <Text className="text-gray-400 text-sm mb-2">Stake Title *</Text>
      <TextInput
        className="bg-white/5 border border-white/10 rounded-xl text-white px-4 py-3 text-base w-full"
        placeholder="e.g. No Instagram for a week"
        placeholderTextColor="#888"
        value={title}
        onChangeText={setTitle}
        maxLength={100}
      />

      {/* Description */}
      <Text className="text-gray-400 text-sm mt-4 mb-2">
        Description (optional)
      </Text>
      <TextInput
        className="bg-white/5 border border-white/10 rounded-xl text-white px-4 py-3 text-base w-full"
        placeholder="Additional details..."
        placeholderTextColor="#888"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={2}
        maxLength={500}
      />

      {/* Opponent - Only show if not solo stake */}
      {!isSoloStake && (
        <>
          <Text className="text-gray-400 text-sm mt-4 mb-2">
            Challenge Someone
          </Text>
          <View className="relative">
            <TextInput
              className="bg-white/5 border border-white/10 rounded-xl text-white pl-4 pr-12 py-3 text-base w-full"
              placeholder="Username or wallet address"
              placeholderTextColor="#888"
              value={opponentWallet}
              onChangeText={handleOpponentChange}
              autoCapitalize="none"
            />
            <View className="absolute right-3 top-3.5">
              {checkingOpponent ? (
                <ActivityIndicator size="small" color="#6b7280" />
              ) : opponentUser ? (
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
              ) : opponentWallet.length > 2 ? (
                <Ionicons name="search" size={20} color="#6b7280" />
              ) : null}
            </View>
          </View>
        </>
      )}
      {!isSoloStake && opponentUser && (
        <Text className="text-green-400 text-xs mt-1">
          Found:{" "}
          {opponentUser.profile?.username ||
            opponentUser.profile?.display_name ||
            "User"}
        </Text>
      )}

      {/* App selection */}
      <Text className="text-gray-400 text-sm mt-4 mb-2">App to Limit *</Text>
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
                  : "bg-white/5 border-white/10"
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

      {/* Duration */}
      <Text className="text-gray-400 text-sm mt-4 mb-2">
        Challenge Duration
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {[1, 3, 7, 14, 30].map((days) => (
          <Pressable
            key={days}
            onPress={() => setDuration(days)}
            className={`mr-2 px-4 py-3 rounded-xl border ${
              duration === days
                ? "bg-blue-500/15 border-blue-400"
                : "bg-white/5 border-white/10"
            }`}
          >
            <Text
              className={duration === days ? "text-blue-200" : "text-white"}
            >
              {days} {days === 1 ? "day" : "days"}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Amount */}
      <Text className="text-gray-400 text-sm mt-4 mb-2">
        Stake Amount (SOL) *
      </Text>
      <View className="relative">
        <TextInput
          className="bg-white/5 border border-white/10 rounded-xl text-white px-4 py-3 pr-16 text-base w-full"
          placeholder="0.00"
          placeholderTextColor="#888"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
        <View className="absolute right-4 top-3.5">
          <Text className="text-gray-400">SOL</Text>
        </View>
      </View>

      {/* Summary */}
      {canCreate && (
        <View className="mt-4 bg-blue-500/10 border border-blue-400/20 rounded-xl p-4">
          <Text className="text-blue-200 font-semibold mb-2">Summary</Text>
          <Text className="text-gray-300 text-sm">
            You are staking{" "}
            <Text className="text-white font-semibold">{amount} SOL</Text> that
            you will keep {appName} usage under{" "}
            <Text className="text-white font-semibold">{minutes} min/day</Text>{" "}
            for{" "}
            <Text className="text-white font-semibold">{duration} days</Text>.
          </Text>
        </View>
      )}

      {/* Create */}
      <Pressable
        disabled={!canCreate || loading}
        className={`rounded-xl py-4 w-full mt-5 ${
          canCreate && !loading ? "bg-blue-500" : "bg-blue-500/30"
        }`}
        onPress={handleCreate}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-bold text-base text-center">
            Create Stake
          </Text>
        )}
      </Pressable>
    </View>
  );
}
