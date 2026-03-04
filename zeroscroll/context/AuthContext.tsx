import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";
import { PublicKey } from "@solana/web3.js";
import { encodeBase58 } from "../utils/base58";
import "../utils/global";
import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";

import { api } from "@/services/api";
import { STORAGE_KEYS, APP_IDENTITY, SOLANA_CLUSTER } from "@/constants/config";
import type {
  Profile,
  AuthState,
  WalletAuthResponse,
  RegisterResponse,
} from "@/types";

interface AuthContextType extends AuthState {
  login: () => Promise<WalletAuthResponse | null>;
  register: (
    username: string,
    displayName: string,
  ) => Promise<RegisterResponse>;
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
  pendingRegistration: boolean;
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
  const [registrationToken, setRegistrationToken] = useState<string | null>(
    null,
  );
  const loginInProgressRef = useRef(false);

  // Update login in progress ref
  const updateLoginInProgress = (value: boolean) => {
    loginInProgressRef.current = value;
  };

  // Load saved auth state on mount
  // We do NOT auto-login — user must always authorize via wallet
  // We only restore the wallet address for display purposes
  const loadSavedAuth = useCallback(async () => {
    console.log("[AUTH] loadSavedAuth starting...");
    if (loginInProgressRef.current) {
      console.log("[AUTH] loadSavedAuth - skipping because login in progress");
      return;
    }
    try {
      const savedWallet = await AsyncStorage.getItem(
        STORAGE_KEYS.WALLET_ADDRESS,
      );

      if (savedWallet) {
        setWalletAddress(savedWallet);
      }

      // Always require wallet authorization — don't auto-login
      console.log(
        "[AUTH] loadSavedAuth - Requiring wallet authorization to login",
      );
      setState((prev) => ({ ...prev, isLoading: false }));
    } catch (error) {
      console.error("[AUTH] loadSavedAuth - Error:", error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    console.log("[AUTH] Initial load - calling loadSavedAuth");
    loadSavedAuth();
  }, [loadSavedAuth]);

  // Re-check auth when app comes back to foreground (after wallet interaction)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log(
        "[AUTH] AppState changed to:",
        nextAppState,
        "loginInProgress:",
        loginInProgressRef.current,
      );
      if (nextAppState === "active" && !loginInProgressRef.current) {
        console.log(
          "[AUTH] App became active - but not reloading (require wallet auth)",
        );
        // Don't reload — we require explicit wallet authorization
      } else if (nextAppState === "active" && loginInProgressRef.current) {
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
  }, []);

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

  const login = useCallback(async (): Promise<WalletAuthResponse | null> => {
    try {
      console.log("[AUTH] === LOGIN START ===");
      updateLoginInProgress(true);

      // Single transact: authorize + API challenge + signMessages all in one wallet session
      console.log("[AUTH] Opening wallet session...");
      const walletResult = await transact(async (wallet: Web3MobileWallet) => {
        // Step 1: Authorize (fingerprint prompt)
        console.log("[AUTH] Step 1: Authorizing...");
        const authResult = await wallet.authorize({
          chain: SOLANA_CLUSTER,
          identity: APP_IDENTITY,
        });

        const base64Address = authResult.accounts?.[0]?.address;
        if (!base64Address) {
          throw new Error("No account returned from wallet");
        }

        // Convert to base58
        const pubkey = new PublicKey(Buffer.from(base64Address, "base64"));
        const walletPubkey = pubkey.toBase58();
        console.log("[AUTH] Wallet pubkey:", walletPubkey);

        // Step 2: Request challenge from backend
        console.log("[AUTH] Step 2: Requesting challenge...");
        const { nonce, message } = await api.requestChallenge(walletPubkey);

        // Step 3: Sign the challenge (same wallet session)
        console.log("[AUTH] Step 3: Signing challenge...");
        const messageBytes = new Uint8Array(Buffer.from(message, "utf-8"));
        const signedMessages = await wallet.signMessages({
          addresses: [base64Address],
          payloads: [messageBytes],
        });

        return {
          base64Address,
          authToken: authResult.auth_token,
          walletPubkey,
          walletLabel: authResult.accounts[0].label || null,
          nonce,
          signResult: signedMessages[0],
        };
      });
      console.log("[AUTH] Wallet session complete");

      const {
        base64Address,
        authToken,
        walletPubkey,
        walletLabel,
        nonce,
        signResult,
      } = walletResult;

      // Save wallet info
      if (authToken) {
        await AsyncStorage.setItem(STORAGE_KEYS.WALLET_AUTH_TOKEN, authToken);
      }
      setWalletBase64(base64Address);
      setWalletAddress(walletPubkey);
      await AsyncStorage.setItem(STORAGE_KEYS.WALLET_ADDRESS, walletPubkey);

      // Convert signature to base58
      let signatureBytes: Uint8Array;
      if (signResult instanceof Uint8Array) {
        signatureBytes = signResult;
      } else if (typeof signResult === "object" && signResult !== null) {
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

      // Step 4: Authenticate with backend
      console.log("[AUTH] Step 4: Authenticating with backend...");
      const authResponse = await api.walletLogin(
        walletPubkey,
        walletLabel,
        nonce,
        signatureBase58,
      );
      console.log("[AUTH] Auth response: is_new =", authResponse.is_new);

      if (authResponse.is_new) {
        // New user — store registration token, don't set authenticated
        console.log("[AUTH] New user — storing registration token");
        setRegistrationToken(authResponse.registration_token || null);
        updateLoginInProgress(false);
        return authResponse;
      }

      // Existing user — complete login
      const { user, profile, access_token } = authResponse;
      if (!user || !access_token) {
        throw new Error("Invalid auth response for existing user");
      }

      api.setAccessToken(access_token);
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access_token),
        AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user)),
        AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile)),
      ]);

      setState({
        user,
        profile: profile || null,
        accessToken: access_token,
        isAuthenticated: true,
        isLoading: false,
      });
      updateLoginInProgress(false);

      console.log("[AUTH] === LOGIN COMPLETE (existing user) ===");
      return authResponse;
    } catch (error: any) {
      console.error("[AUTH] Login error:", error?.message);
      updateLoginInProgress(false);
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const register = useCallback(
    async (
      username: string,
      displayName: string,
    ): Promise<RegisterResponse> => {
      try {
        console.log("[AUTH] === REGISTER START ===");
        if (!registrationToken) {
          throw new Error(
            "No registration token. Please connect wallet first.",
          );
        }

        const result = await api.register(
          registrationToken,
          username,
          displayName,
        );
        console.log("[AUTH] Registration successful, user:", result.user.id);

        // Set token and save everything
        api.setAccessToken(result.access_token);
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, result.access_token),
          AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(result.user)),
          AsyncStorage.setItem(
            STORAGE_KEYS.PROFILE,
            JSON.stringify(result.profile),
          ),
        ]);

        // Clear registration token, set authenticated
        setRegistrationToken(null);
        setState({
          user: result.user,
          profile: result.profile,
          accessToken: result.access_token,
          isAuthenticated: true,
          isLoading: false,
        });

        console.log("[AUTH] === REGISTER COMPLETE ===");
        return result;
      } catch (error: any) {
        console.error("[AUTH] Registration error:", error?.message);
        throw error;
      }
    },
    [registrationToken],
  );

  const logout = useCallback(async () => {
    // No need to deauthorize the wallet — we require fresh authorize() on every login.
    // Calling transact() here can leave the MWA session in a bad state,
    // causing "cannot send in closed" on the next login attempt.
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
    register,
    logout,
    refreshProfile,
    updateProfile,
    setUsername,
    walletAddress,
    walletBase64,
    pendingRegistration: !!registrationToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
