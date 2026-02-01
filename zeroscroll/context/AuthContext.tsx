import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";
import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";

import { api } from "@/services/api";
import { STORAGE_KEYS, APP_IDENTITY, SOLANA_CLUSTER } from "@/constants/config";
import type { Profile, AuthState, LoginResponse } from "@/types";

// Polyfill Buffer for React Native
global.Buffer = global.Buffer || Buffer;

interface AuthContextType extends AuthState {
  login: () => Promise<LoginResponse | null>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: {
    display_name?: string;
    avatar_url?: string;
    bio?: string;
  }) => Promise<Profile>;
  setUsername: (username: string) => Promise<Profile>;
  walletAddress: string | null;
  walletBase64: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBase64, setWalletBase64] = useState<string | null>(null);
  const [loginInProgress, setLoginInProgress] = useState(false);

  // Load saved auth state on mount
  useEffect(() => {
    console.log("[AUTH] Initial load - calling loadSavedAuth");
    loadSavedAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-check auth when app comes back to foreground (after wallet interaction)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log(
        "[AUTH] AppState changed to:",
        nextAppState,
        "loginInProgress:",
        loginInProgress,
      );
      if (nextAppState === "active" && !loginInProgress) {
        console.log("[AUTH] App became active - reloading saved auth");
        loadSavedAuth();
      } else if (nextAppState === "active" && loginInProgress) {
        console.log(
          "[AUTH] App became active but login in progress - skipping reload",
        );
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => subscription?.remove();
  }, [loginInProgress]);

  const loadSavedAuth = async () => {
    console.log("[AUTH] loadSavedAuth starting...");
    if (loginInProgress) {
      console.log("[AUTH] loadSavedAuth - skipping because login in progress");
      return;
    }
    try {
      const [token, userJson, , savedWallet] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.USER),
        AsyncStorage.getItem(STORAGE_KEYS.PROFILE), // Not used, but we still fetch to warm cache
        AsyncStorage.getItem(STORAGE_KEYS.WALLET_ADDRESS),
      ]);
      console.log(
        "[AUTH] loadSavedAuth - token exists:",
        !!token,
        "userJson exists:",
        !!userJson,
      );

      if (savedWallet) {
        setWalletAddress(savedWallet);
      }

      if (token && userJson) {
        console.log(
          "[AUTH] loadSavedAuth - Found token and user, validating...",
        );
        // Parse saved user data
        const savedUser = JSON.parse(userJson);
        // savedProfile is parsed but only used for validation - fresh profile comes from API

        // Set token in API service
        api.setAccessToken(token);

        // Verify token is still valid by fetching profile
        try {
          console.log(
            "[AUTH] loadSavedAuth - Fetching /me to validate token...",
          );
          // /me endpoint only returns { profile }, not { user, profile }
          const { profile: freshProfile } = await api.getMe();
          console.log(
            "[AUTH] loadSavedAuth - /me SUCCESS! Setting isAuthenticated=true",
          );

          setState({
            user: savedUser, // Use saved user data (it doesn't change)
            profile: freshProfile,
            accessToken: token,
            isAuthenticated: true,
            isLoading: false,
          });

          // Update stored profile with fresh data (user doesn't change)
          await AsyncStorage.setItem(
            STORAGE_KEYS.PROFILE,
            JSON.stringify(freshProfile),
          );
          console.log("[AUTH] loadSavedAuth - Complete! User authenticated.");
        } catch (err) {
          // Token expired or invalid, clear auth
          console.log(
            "[AUTH] loadSavedAuth - Token invalid, clearing auth:",
            err,
          );
          await clearAuth();
        }
      } else {
        console.log(
          "[AUTH] loadSavedAuth - No token or user found, setting isLoading=false",
        );
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error("[AUTH] loadSavedAuth - Error:", error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const clearAuth = async () => {
    api.setAccessToken(null);
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.ACCESS_TOKEN,
      STORAGE_KEYS.USER,
      STORAGE_KEYS.PROFILE,
      STORAGE_KEYS.WALLET_ADDRESS,
      STORAGE_KEYS.WALLET_AUTH_TOKEN,
    ]);
    setState({
      user: null,
      profile: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
    setWalletAddress(null);
    setWalletBase64(null);
  };

  const login = useCallback(async (): Promise<LoginResponse | null> => {
    try {
      console.log("[AUTH] === LOGIN START ===");
      setLoginInProgress(true);
      setState((prev) => ({ ...prev, isLoading: true }));

      // Step 1: Connect to wallet and get pubkey
      console.log("[AUTH] Step 1: Connecting to wallet...");
      const authResult = await transact(async (wallet: Web3MobileWallet) => {
        console.log("[AUTH] Inside transact - calling authorize");
        const result = await wallet.authorize({
          chain: SOLANA_CLUSTER,
          identity: APP_IDENTITY,
        });
        console.log(
          "[AUTH] Authorize complete, accounts:",
          result.accounts?.length,
        );
        return result;
      });
      console.log("[AUTH] Step 1 complete - got authResult");

      const base64Address = authResult.accounts?.[0]?.address;
      if (!base64Address) {
        throw new Error("No account returned from wallet");
      }
      console.log(
        "[AUTH] Got base64Address:",
        base64Address.substring(0, 20) + "...",
      );

      // Convert base64 to base58
      const pubkey = new PublicKey(Buffer.from(base64Address, "base64"));
      const walletPubkey = pubkey.toBase58();
      const walletLabel = authResult.accounts[0].label || null;
      console.log("[AUTH] Wallet pubkey:", walletPubkey);

      setWalletBase64(base64Address);
      setWalletAddress(walletPubkey);
      await AsyncStorage.setItem(STORAGE_KEYS.WALLET_ADDRESS, walletPubkey);

      // Step 2: Request challenge from backend
      console.log("[AUTH] Step 2: Requesting challenge from backend...");
      console.log("[AUTH] API URL check - calling requestChallenge");
      const { nonce, message } = await api.requestChallenge(walletPubkey);
      console.log("[AUTH] Step 2 complete - Got challenge, nonce:", nonce);
      console.log(
        "[AUTH] Challenge message:",
        message.substring(0, 50) + "...",
      );

      // Step 3: Sign the message with wallet
      console.log("[AUTH] Step 3: Signing message with wallet...");
      const signResult = await transact(async (wallet: Web3MobileWallet) => {
        console.log("[AUTH] Inside transact for signing - re-authorizing");
        // Re-authorize to get signing capability
        const reauth = await wallet.authorize({
          chain: SOLANA_CLUSTER,
          identity: APP_IDENTITY,
        });
        console.log("[AUTH] Re-auth complete");

        // Use the address from reauthorization (it may be different)
        const currentAddress = reauth.accounts[0]?.address || base64Address;
        console.log(
          "[AUTH] Signing with address:",
          currentAddress.substring(0, 20) + "...",
        );

        // Sign the challenge message
        const messageBytes = new TextEncoder().encode(message);
        console.log("[AUTH] Message bytes length:", messageBytes.length);

        console.log("[AUTH] Calling wallet.signMessages...");
        const signedMessages = await wallet.signMessages({
          addresses: [currentAddress],
          payloads: [messageBytes],
        });
        console.log(
          "[AUTH] signMessages returned, count:",
          signedMessages?.length,
        );

        // signMessages returns SignedPayload[] which contains signatures
        // The signature is the signed_payload itself for message signing
        return signedMessages[0];
      });
      console.log(
        "[AUTH] Step 3 complete - got signResult type:",
        typeof signResult,
      );

      // Step 4: Convert signature to base58
      // signResult should be Uint8Array
      let signatureBytes: Uint8Array;
      if (signResult instanceof Uint8Array) {
        signatureBytes = signResult;
      } else if (typeof signResult === "object" && signResult !== null) {
        // Handle if it's a SignedMessage object
        const signed = signResult as {
          signature?: Uint8Array;
          signedMessage?: Uint8Array;
        };
        signatureBytes =
          signed.signature ||
          signed.signedMessage ||
          new Uint8Array(signResult as ArrayBuffer);
      } else {
        throw new Error("Invalid signature format received from wallet");
      }

      const signatureBase58 = encodeBase58(signatureBytes);
      console.log(
        "[AUTH] Step 4 complete - Signature base58 length:",
        signatureBase58.length,
      );

      // Step 5: Login to backend
      console.log("[AUTH] Step 5: Sending login to backend...");
      const loginResponse = await api.walletLogin(
        walletPubkey,
        walletLabel,
        nonce,
        signatureBase58,
      );
      console.log("[AUTH] Step 5 complete - Login successful!");
      console.log("[AUTH] is_new:", loginResponse.is_new);
      console.log("[AUTH] user_id:", loginResponse.user?.id);

      // Set token in API service
      api.setAccessToken(loginResponse.access_token);

      // Save to storage
      await AsyncStorage.setItem(
        STORAGE_KEYS.ACCESS_TOKEN,
        loginResponse.access_token,
      );
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER,
        JSON.stringify(loginResponse.user),
      );
      await AsyncStorage.setItem(
        STORAGE_KEYS.PROFILE,
        JSON.stringify(loginResponse.profile),
      );

      console.log("[AUTH] Step 6: Updating state...");
      setState({
        user: loginResponse.user,
        profile: loginResponse.profile,
        accessToken: loginResponse.access_token,
        isAuthenticated: true,
        isLoading: false,
      });
      console.log("[AUTH] State updated, isAuthenticated=true");
      setLoginInProgress(false);

      console.log("[AUTH] === LOGIN COMPLETE ===");
      return loginResponse;
    } catch (error: any) {
      console.error("[AUTH] === LOGIN ERROR ===");
      console.error("[AUTH] Error:", error);
      console.error("[AUTH] Error message:", error?.message);
      console.error("[AUTH] Error stack:", error?.stack);
      setLoginInProgress(false);
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    // Optionally deauthorize the wallet
    try {
      await transact(async (wallet: Web3MobileWallet) => {
        // Just deauthorize, no need to wait
        wallet
          .deauthorize({
            auth_token:
              (await AsyncStorage.getItem(STORAGE_KEYS.WALLET_AUTH_TOKEN)) ||
              "",
          })
          .catch(() => {});
      });
    } catch {
      // Ignore deauth errors
    }

    await clearAuth();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!state.accessToken) return;

    try {
      // /me only returns { profile }, not { user, profile }
      const { profile } = await api.getMe();
      setState((prev) => ({
        ...prev,
        profile,
      }));
      await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch (error) {
      console.error("Error refreshing profile:", error);
    }
  }, [state.accessToken]);

  const updateProfile = useCallback(
    async (data: {
      display_name?: string;
      avatar_url?: string;
      bio?: string;
    }): Promise<Profile> => {
      const updatedProfile = await api.updateProfile(data);
      setState((prev) => ({
        ...prev,
        profile: updatedProfile,
      }));
      await AsyncStorage.setItem(
        STORAGE_KEYS.PROFILE,
        JSON.stringify(updatedProfile),
      );
      return updatedProfile;
    },
    [],
  );

  const setUsername = useCallback(
    async (username: string): Promise<Profile> => {
      const updatedProfile = await api.setUsername(username);
      setState((prev) => ({
        ...prev,
        profile: updatedProfile,
      }));
      await AsyncStorage.setItem(
        STORAGE_KEYS.PROFILE,
        JSON.stringify(updatedProfile),
      );
      return updatedProfile;
    },
    [],
  );

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    refreshProfile,
    updateProfile,
    setUsername,
    walletAddress,
    walletBase64,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Base58 encoding helper
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE = 58n;

function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";

  // Count leading zeros
  let zeros = 0;
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    zeros++;
  }

  // Convert to big integer
  let num = 0n;
  for (const byte of bytes) {
    num = num * 256n + BigInt(byte);
  }

  // Convert to base58
  let result = "";
  while (num > 0n) {
    const mod = Number(num % BASE);
    result = ALPHABET[mod] + result;
    num = num / BASE;
  }

  // Add leading '1's for each leading zero byte
  return "1".repeat(zeros) + result;
}

export default AuthContext;
