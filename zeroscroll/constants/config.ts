// API Configuration
// Change this to your backend URL

// For Android EMULATOR use: "http://10.0.2.2:3000"
// For PHYSICAL DEVICE use your computer's local IP: "http://192.168.X.X:3000"
// Find your IP with: ip addr show | grep "inet " | grep -v 127.0.0.1

export const API_URL = __DEV__
  ? "http://192.168.110.207:3000" // <-- CHANGE THIS to your computer's IP for physical device
  : "https://your-production-api.com";

// App Identity for MWA
// Note: icon must be a relative URI path, not an absolute URL
export const APP_IDENTITY = {
  name: "ZeroScroll",
  uri: "https://zeroscroll.app",
  icon: "/icon.png", // Relative URI as required by MWA protocol
};

// Solana cluster
export const SOLANA_CLUSTER = "solana:devnet"; // Change to 'solana:mainnet-beta' for production

// App Owner Wallet (receives lost solo stakes)
export const APP_OWNER_WALLET = "Bnne37SwhZH2tn3MC3fx6B5ZKWRWTfzFFPw8c8Tg5ixc";

// Constants
export const LAMPORTS_PER_SOL = 1_000_000_000;

// Storage keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: "zcrow_access_token",
  USER: "zcrow_user",
  PROFILE: "zcrow_profile",
  WALLET_ADDRESS: "wallet_address",
  WALLET_AUTH_TOKEN: "wallet_auth_token",
};

// Token expiry (7 days in ms)
export const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
