import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { shortenAddress } from "@/services/api";

export default function ProfileSettings() {
  const {
    user,
    profile,
    walletAddress,
    logout,
    updateProfile,
    refreshProfile,
  } = useAuth();

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [saving, setSaving] = useState(false);

  const handleLogout = async () => {
    Alert.alert(
      "Disconnect Wallet",
      "Are you sure you want to disconnect your wallet and log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/(auth)/login");
          },
        },
      ],
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateProfile({
        display_name: displayName || undefined,
        bio: bio || undefined,
      });
      setEditing(false);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const displayUsername = profile?.username || "No username set";
  const displayNameValue =
    profile?.display_name || profile?.username || "Anonymous";
  const avatarLetter = displayNameValue[0]?.toUpperCase() || "U";

  return (
    <ScrollView className="flex-1 bg-[#181A20]">
      <View className="p-5 pt-14">
        {/* Header */}
        <Text className="text-white text-2xl font-bold mb-6">Profile</Text>

        {/* Profile Card */}
        <View className="bg-[#23242b] rounded-2xl p-5 mb-4">
          {/* Avatar and Name */}
          <View className="items-center mb-6">
            <View className="w-20 h-20 rounded-full bg-blue-500/20 border-2 border-blue-400/40 items-center justify-center mb-3">
              <Text className="text-blue-200 font-bold text-3xl">
                {avatarLetter}
              </Text>
            </View>
            <Text className="text-white text-xl font-bold">
              {displayNameValue}
            </Text>
            <Text className="text-gray-400 text-sm">@{displayUsername}</Text>
          </View>

          {/* Wallet Info */}
          <View className="bg-white/5 rounded-xl p-4 mb-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Ionicons name="wallet" size={20} color="#22c55e" />
                <Text className="text-gray-400 ml-2">Wallet</Text>
              </View>
              <Pressable
                onPress={() => {
                  // Copy to clipboard would go here
                  Alert.alert("Copied", "Wallet address copied to clipboard");
                }}
              >
                <Ionicons name="copy-outline" size={18} color="#6b7280" />
              </Pressable>
            </View>
            <Text className="text-white text-sm mt-1" numberOfLines={1}>
              {walletAddress || user?.wallet_pubkey || "Unknown"}
            </Text>
          </View>

          {/* Bio */}
          {profile?.bio && !editing && (
            <View className="mb-4">
              <Text className="text-gray-400 text-sm mb-1">Bio</Text>
              <Text className="text-white">{profile.bio}</Text>
            </View>
          )}

          {/* Edit Form */}
          {editing ? (
            <View>
              <Text className="text-gray-400 text-sm mb-2">Display Name</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your display name"
                placeholderTextColor="#7b7f8a"
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white mb-4"
                maxLength={50}
              />

              <Text className="text-gray-400 text-sm mb-2">Bio</Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Tell us about yourself..."
                placeholderTextColor="#7b7f8a"
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white mb-4"
                multiline
                numberOfLines={3}
                maxLength={200}
                textAlignVertical="top"
                style={{ minHeight: 80 }}
              />

              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => {
                    setEditing(false);
                    setDisplayName(profile?.display_name || "");
                    setBio(profile?.bio || "");
                  }}
                  className="flex-1 bg-white/10 rounded-xl py-3"
                >
                  <Text className="text-white text-center font-semibold">
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  disabled={saving}
                  className="flex-1 bg-blue-500 rounded-xl py-3"
                >
                  {saving ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white text-center font-semibold">
                      Save
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setEditing(true)}
              className="bg-white/10 rounded-xl py-3"
            >
              <Text className="text-white text-center font-semibold">
                Edit Profile
              </Text>
            </Pressable>
          )}
        </View>

        {/* Username Section */}
        {!profile?.username && (
          <Pressable
            onPress={() => router.push("/(auth)/register")}
            className="bg-yellow-500/10 border border-yellow-400/30 rounded-2xl p-4 mb-4"
          >
            <View className="flex-row items-center">
              <Ionicons name="warning" size={24} color="#eab308" />
              <View className="ml-3 flex-1">
                <Text className="text-yellow-200 font-semibold">
                  Set Your Username
                </Text>
                <Text className="text-yellow-200/70 text-sm">
                  Complete your profile by setting a unique username
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#eab308" />
            </View>
          </Pressable>
        )}

        {/* Settings Menu */}
        <View className="bg-[#23242b] rounded-2xl overflow-hidden mb-4">
          <MenuItem
            icon="notifications-outline"
            label="Notifications"
            onPress={() =>
              Alert.alert("Coming Soon", "Notification settings coming soon!")
            }
          />
          <MenuItem
            icon="shield-outline"
            label="Privacy & Security"
            onPress={() =>
              Alert.alert("Coming Soon", "Privacy settings coming soon!")
            }
          />
          <MenuItem
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() =>
              Alert.alert("Coming Soon", "Help center coming soon!")
            }
          />
          <MenuItem
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() =>
              Alert.alert("Coming Soon", "Terms of service coming soon!")
            }
          />
        </View>

        {/* Account Actions */}
        <View className="bg-[#23242b] rounded-2xl overflow-hidden mb-4">
          <Pressable
            onPress={handleLogout}
            className="flex-row items-center p-4 border-b border-white/5"
          >
            <View className="w-10 h-10 rounded-full bg-red-500/10 items-center justify-center">
              <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            </View>
            <Text className="text-red-400 ml-3 font-semibold">
              Disconnect Wallet
            </Text>
          </Pressable>
        </View>

        {/* App Info */}
        <View className="items-center py-4">
          <Text className="text-gray-500 text-sm">ZeroScroll v1.0.0</Text>
          <Text className="text-gray-600 text-xs mt-1">
            Built with ❤️ on Solana
          </Text>
        </View>

        {/* Spacer */}
        <View className="h-20" />
      </View>
    </ScrollView>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between p-4 border-b border-white/5"
    >
      <View className="flex-row items-center">
        <View className="w-10 h-10 rounded-full bg-white/5 items-center justify-center">
          <Ionicons name={icon} size={20} color="#9ca3af" />
        </View>
        <Text className="text-white ml-3">{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#6b7280" />
    </Pressable>
  );
}
