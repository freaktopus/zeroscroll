import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { api, shortenAddress } from "@/services/api";
import { Ionicons } from "@expo/vector-icons";
import debounce from "@/utils/debounce";

export default function Register() {
  const router = useRouter();
  const {
    walletAddress,
    register,
    isAuthenticated,
    isLoading,
    pendingRegistration,
  } = useAuth();

  const [usernameInput, setUsernameInput] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");

  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null,
  );
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not in a valid state (neither authenticated nor pending registration)
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !pendingRegistration) {
      router.replace("/(auth)/login");
    }
  }, [isAuthenticated, isLoading, pendingRegistration, router]);

  // Check username availability with debounce
  const checkUsername = useMemo(
    () =>
      debounce(async (username: string) => {
        if (!username || username.length < 3) {
          setUsernameAvailable(null);
          setCheckingUsername(false);
          return;
        }

        // Validate format: 3-20 chars, alphanumeric + underscore
        const validFormat = /^[a-zA-Z0-9_]{3,20}$/.test(username);
        if (!validFormat) {
          setUsernameAvailable(false);
          setCheckingUsername(false);
          return;
        }

        try {
          setCheckingUsername(true);
          const { available } = await api.checkUsername(username);
          setUsernameAvailable(available);
        } catch (err) {
          console.error("Error checking username:", err);
          setUsernameAvailable(null);
        } finally {
          setCheckingUsername(false);
        }
      }, 500),
    [],
  );

  useEffect(() => {
    if (usernameInput.length > 0) {
      setCheckingUsername(true);
      checkUsername(usernameInput);
    } else {
      setUsernameAvailable(null);
    }
  }, [usernameInput, checkUsername]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      if (!usernameInput || usernameInput.length < 3) {
        Alert.alert(
          "Required",
          "Please enter a username (at least 3 characters).",
        );
        setSaving(false);
        return;
      }

      if (!displayName.trim()) {
        Alert.alert("Required", "Please enter a display name.");
        setSaving(false);
        return;
      }

      if (!usernameAvailable) {
        Alert.alert(
          "Username Unavailable",
          "Please choose a different username.",
        );
        setSaving(false);
        return;
      }

      // Register with backend — creates user + profile with username & display name
      await register(usernameInput, displayName.trim());

      // Registration sets isAuthenticated=true → root layout redirects to tabs
      router.replace("/(tabs)");
    } catch (err: any) {
      console.error("Registration error:", err);
      setError(err.message || "Failed to create account");
      Alert.alert(
        "Error",
        err.message || "Failed to create account. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    router.replace("/(auth)/login");
  };

  const canSave =
    usernameInput.length >= 3 &&
    displayName.trim().length > 0 &&
    usernameAvailable === true &&
    !checkingUsername;

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#181A20] items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-[#181A20]"
      contentContainerStyle={{ padding: 20, paddingTop: 60 }}
    >
      {/* Header */}
      <View className="mb-6">
        <Text className="text-white text-3xl font-bold">
          Create Your Profile
        </Text>
        <Text className="text-gray-400 mt-2">
          Choose a username and display name to complete your account.
        </Text>
      </View>

      {/* Wallet Info */}
      <View className="bg-[#23242b] rounded-2xl p-4 border border-white/10 mb-4">
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-green-500/20 border border-green-400/40 items-center justify-center">
            <Ionicons name="wallet" size={18} color="#22c55e" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-gray-400 text-xs">Connected Wallet</Text>
            <Text className="text-white text-sm" numberOfLines={1}>
              {walletAddress ? shortenAddress(walletAddress, 8) : "Unknown"}
            </Text>
          </View>
        </View>
      </View>

      {/* Form */}
      <View className="bg-[#23242b] rounded-2xl p-5 border border-white/10">
        {/* Username */}
        <Text className="text-gray-300 text-sm mb-2">Username *</Text>
        <View className="relative">
          <TextInput
            value={usernameInput}
            onChangeText={setUsernameInput}
            placeholder="e.g. satoshi"
            placeholderTextColor="#7b7f8a"
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
          />
          <View className="absolute right-3 top-3">
            {checkingUsername ? (
              <ActivityIndicator size="small" color="#6b7280" />
            ) : usernameAvailable === true ? (
              <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
            ) : usernameAvailable === false ? (
              <Ionicons name="close-circle" size={22} color="#ef4444" />
            ) : null}
          </View>
        </View>
        <Text className="text-gray-500 text-xs mt-1">
          3-20 characters, letters, numbers, underscores only
        </Text>

        {/* Display Name */}
        <Text className="text-gray-300 text-sm mt-5 mb-2">Display Name *</Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your display name"
          placeholderTextColor="#7b7f8a"
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
          maxLength={50}
        />

        {/* Bio */}
        <Text className="text-gray-300 text-sm mt-5 mb-2">Bio</Text>
        <TextInput
          value={bio}
          onChangeText={setBio}
          placeholder="Tell us about yourself..."
          placeholderTextColor="#7b7f8a"
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
          multiline
          numberOfLines={3}
          maxLength={200}
          textAlignVertical="top"
          style={{ minHeight: 80 }}
        />

        {/* Error */}
        {error && (
          <View className="bg-red-500/10 border border-red-400/30 rounded-xl p-3 mt-4">
            <Text className="text-red-200 text-sm">{error}</Text>
          </View>
        )}

        {/* Create Account Button */}
        <Pressable
          onPress={handleSave}
          disabled={!canSave || saving}
          className={`mt-6 rounded-xl py-4 ${canSave && !saving ? "bg-blue-500" : "bg-blue-500/30"}`}
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-center text-base">
              Create Account
            </Text>
          )}
        </Pressable>

        {/* Back to wallet connect */}
        <Pressable onPress={handleBack} className="mt-4 py-2">
          <Text className="text-gray-300 text-center">
            <Text className="text-blue-300 font-semibold">
              ← Use a different wallet
            </Text>
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
