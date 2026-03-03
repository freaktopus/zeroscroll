export const API_URL = __DEV__
  ? "http://192.168.1.14:3000" // laptop Ip
  : "https://your-production-api.com"; //when there is production ready api for backed zcrow

// App Identity for MWA - Mobile Wallet Adapter requires a unique identity for the app to request wallet connections and transactions. This should be consistent across all interactions with the wallet.
export const APP_IDENTITY = {
  name: "ZeroScroll",
  uri: "https://zeroscroll.app",
  icon: "/icon.png", // relative path for the pulbic icon
};

// tell zeroscroll app which solona network to consider
export const SOLANA_CLUSTER = "solana:devnet"; // free tokens usages so devnet

// Default account to recieve users loss amount
// Account: Freaktopus
export const APP_OWNER_WALLET = "Bnne37SwhZH2tn3MC3fx6B5ZKWRWTfzFFPw8c8Tg5ixc";

// Solana transaction are counted in lamports, which are 1 billionth of a SOL. This constant is used to convert between SOL and lamports when displaying balances or sending transactions.
export const LAMPORTS_PER_SOL = 1_000_000_000;

export const STORAGE_KEYS = {
  ACCESS_TOKEN: "zcrow_access_token",
  USER: "zcrow_user",
  PROFILE: "zcrow_profile",
  WALLET_ADDRESS: "wallet_address",
  WALLET_AUTH_TOKEN: "wallet_auth_token",
};

// Token expiry (7 days in ms)
export const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
