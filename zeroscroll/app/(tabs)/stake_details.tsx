import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, formatSol, formatDate, lamportsToSol } from "@/services/api";
import type { Transaction, BalanceResponse } from "@/types";

export default function StakeDetailsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [balanceData, txData] = await Promise.all([
        api.getBalance("SOL").catch(() => null),
        api
          .getTransactions(50, 0)
          .catch(() => ({ transactions: [], total: 0 })),
      ]);

      if (balanceData) {
        setBalance(balanceData);
      }
      setTransactions(txData.transactions);
    } catch (err) {
      console.error("Error fetching wallet details:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Calculate stats
  const totalCredits = transactions
    .filter((tx) => tx.kind === "credit")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalReleased = transactions
    .filter((tx) => tx.kind === "release")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalLocked = transactions
    .filter((tx) => tx.kind === "lock")
    .reduce((sum, tx) => sum + tx.amount, 0);

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
        />
      }
    >
      <View className="p-5 pt-14">
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <Pressable onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>
          <Text className="text-white text-2xl font-bold">Wallet Details</Text>
        </View>

        {/* Balance Card */}
        <View className="bg-gradient-to-br bg-[#23242b] rounded-2xl p-6 mb-6">
          <Text className="text-gray-400 text-sm">Available Balance</Text>
          <Text className="text-white text-4xl font-bold mt-1">
            {balance ? lamportsToSol(balance.balance).toFixed(4) : "0.0000"} SOL
          </Text>

          {balance && balance.pending_stakes > 0 && (
            <View className="flex-row items-center mt-3 bg-blue-500/10 rounded-lg px-3 py-2">
              <Ionicons name="lock-closed" size={16} color="#3b82f6" />
              <Text className="text-blue-300 ml-2">
                {lamportsToSol(balance.pending_stakes).toFixed(4)} SOL in active
                stakes
              </Text>
            </View>
          )}
        </View>

        {/* Stats Grid */}
        <View className="flex-row mb-6">
          <StatCard
            title="Credits"
            value={formatSol(totalCredits)}
            icon="arrow-down-circle"
            color="#3b82f6"
          />
          <StatCard
            title="Released"
            value={formatSol(totalReleased)}
            icon="trending-up"
            color="#22c55e"
          />
          <StatCard
            title="Locked"
            value={formatSol(totalLocked)}
            icon="lock-closed"
            color="#f97316"
          />
        </View>

        {/* Transaction History */}
        <View className="mb-4">
          <Text className="text-gray-400 text-base mb-3">
            Transaction History
          </Text>

          {transactions.length > 0 ? (
            <View className="bg-[#23242b] rounded-2xl overflow-hidden">
              {transactions.map((tx, index) => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  isLast={index === transactions.length - 1}
                />
              ))}
            </View>
          ) : (
            <View className="bg-[#23242b] rounded-2xl p-8 items-center">
              <Ionicons name="receipt-outline" size={48} color="#4b5563" />
              <Text className="text-gray-400 mt-3 text-center">
                No transactions yet
              </Text>
              <Text className="text-gray-500 text-sm text-center mt-1">
                Create a stake to see your transaction history
              </Text>
            </View>
          )}
        </View>

        {/* Spacer */}
        <View className="h-20" />
      </View>
    </ScrollView>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  return (
    <View className="flex-1 bg-[#23242b] rounded-xl p-4 mx-1">
      <View
        className="w-8 h-8 rounded-full items-center justify-center mb-2"
        style={{ backgroundColor: `${color}20` }}
      >
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text className="text-gray-400 text-xs">{title}</Text>
      <Text className="text-white font-semibold mt-1">{value}</Text>
    </View>
  );
}

function TransactionRow({
  transaction,
  isLast,
}: {
  transaction: Transaction;
  isLast: boolean;
}) {
  const getTypeConfig = (kind: string) => {
    switch (kind) {
      case "credit":
        return {
          icon: "arrow-down-circle",
          color: "#3b82f6",
          prefix: "+",
          bgColor: "bg-blue-500/10",
          label: "Credit",
        };
      case "debit":
        return {
          icon: "arrow-up-circle",
          color: "#f97316",
          prefix: "-",
          bgColor: "bg-orange-500/10",
          label: "Debit",
        };
      case "lock":
        return {
          icon: "lock-closed",
          color: "#a855f7",
          prefix: "-",
          bgColor: "bg-purple-500/10",
          label: "Locked in Stake",
        };
      case "release":
        return {
          icon: "trophy",
          color: "#22c55e",
          prefix: "+",
          bgColor: "bg-green-500/10",
          label: "Won",
        };
      case "refund":
        return {
          icon: "refresh",
          color: "#6366f1",
          prefix: "+",
          bgColor: "bg-indigo-500/10",
          label: "Refund",
        };
      case "fee":
        return {
          icon: "cash",
          color: "#6b7280",
          prefix: "-",
          bgColor: "bg-gray-500/10",
          label: "Fee",
        };
      default:
        return {
          icon: "ellipse",
          color: "#6b7280",
          prefix: "",
          bgColor: "bg-gray-500/10",
          label: kind,
        };
    }
  };

  const config = getTypeConfig(transaction.kind);
  const amountColor =
    config.prefix === "+"
      ? "text-green-400"
      : config.prefix === "-"
        ? "text-red-400"
        : "text-white";

  return (
    <View
      className={`flex-row items-center p-4 ${!isLast ? "border-b border-white/5" : ""}`}
    >
      {/* Icon */}
      <View
        className={`w-10 h-10 rounded-full items-center justify-center ${config.bgColor}`}
      >
        <Ionicons name={config.icon as any} size={20} color={config.color} />
      </View>

      {/* Details */}
      <View className="flex-1 ml-3">
        <Text className="text-white font-semibold">{config.label}</Text>
        <Text className="text-gray-400 text-sm">
          {formatDate(transaction.created_at)}
        </Text>
      </View>

      {/* Amount */}
      <View className="items-end">
        <Text className={`font-semibold ${amountColor}`}>
          {config.prefix}
          {formatSol(transaction.amount)}
        </Text>
        <Text className="text-gray-500 text-xs">
          {formatDate(transaction.created_at)}
        </Text>
      </View>
    </View>
  );
}
