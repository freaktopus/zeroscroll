import React from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { BalanceResponse } from "@/types";
import { lamportsToSol } from "@/services/api";
import { useSolanaBalance } from "@/hooks/useSolanaBalance";
import { useAuth } from "@/context/AuthContext";

interface WalletInfoProps {
  balance?: BalanceResponse | null;
}

export default function WalletInfo({ balance }: WalletInfoProps) {
  const navigation = useNavigation();
  const { walletAddress } = useAuth();

  // Fetch real on-chain balance from Solana
  const {
    balance: onChainBalance,
    isLoading: balanceLoading,
    network,
  } = useSolanaBalance(walletAddress);

  // Use on-chain balance for display, fall back to API balance
  const totalBalance = onChainBalance
    ? onChainBalance.sol
    : balance
      ? lamportsToSol(balance.balance)
      : 0;
  const pendingStakes = balance ? lamportsToSol(balance.pending_stakes) : 0;

  // Calculate estimated values (these would come from API in production)
  const stakeLoss = 0; // Would be calculated from transactions
  const stakeReceived = 0; // Would be calculated from transactions

  return (
    <Pressable
      onPress={() => navigation.navigate("stake_details" as never)}
      className="bg-[#23242b] rounded-3xl p-5 mb-5"
      style={{
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
      }}
    >
      {/* Header */}
      <View className="flex-row justify-between items-center">
        <Text className="text-white text-lg font-semibold">Wallet Summary</Text>
        <View className="flex-row items-center">
          <Text className="text-gray-500 text-xs mr-2">{network}</Text>
          {balanceLoading && <ActivityIndicator size="small" color="#6b7280" />}
          <Ionicons name="chevron-forward" size={18} color="#6b7280" />
        </View>
      </View>

      <View className="h-[1px] bg-white/10 my-3" />

      {/* Main Balance */}
      <View>
        <Text className="text-gray-400 text-xs">On-Chain Balance</Text>
        <Text className="text-white text-3xl font-bold mt-1">
          {totalBalance.toFixed(4)} <Text className="text-lg">SOL</Text>
        </Text>
        {onChainBalance && (
          <Text className="text-gray-500 text-xs mt-1">
            {onChainBalance.lamports.toLocaleString()} lamports
          </Text>
        )}
      </View>

      {/* Divider */}
      <View className="h-[1px] bg-white/10 my-3" />

      <View className="flex-row h-auto justify-between">
        {/* Stats */}
        <StatCol
          label="In Stakes"
          value={pendingStakes.toFixed(2)}
          icon="lock-closed"
          iconBg="bg-blue-500/15"
          iconColor="#3b82f6"
          valueColor="text-blue-300"
        />

        <StatCol
          label="Won"
          value={stakeReceived.toFixed(2)}
          icon="trending-up"
          iconBg="bg-green-500/15"
          iconColor="#22c55e"
          valueColor="text-green-300"
        />

        <StatCol
          label="Lost"
          value={stakeLoss.toFixed(2)}
          icon="trending-down"
          iconBg="bg-red-500/15"
          iconColor="#ef4444"
          valueColor="text-red-300"
        />
      </View>
    </Pressable>
  );
}

function StatCol({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  valueColor = "text-white",
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  valueColor?: string;
}) {
  return (
    <View className="flex-col items-center">
      {/* Icon and label */}
      <View className="flex-col items-center">
        <View
          className={`w-9 h-9 rounded-full items-center justify-center ${iconBg}`}
        >
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
        <Text className="mt-1 text-gray-300 text-sm">{label}</Text>
      </View>
      {/* Value */}
      <Text className={`text-base font-semibold ${valueColor}`}>{value}</Text>
    </View>
  );
}
