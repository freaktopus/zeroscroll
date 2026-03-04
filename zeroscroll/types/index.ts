// User types
export interface User {
  id: string;
  wallet_pubkey: string;
  wallet_label: string | null;
  created_at: string;
  last_login_at: string;
}

export interface Profile {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  updated_at: string;
}

export interface UserWithProfile {
  user: User;
  profile: Profile;
}

// The /me endpoint only returns profile
export interface MeResponse {
  profile: Profile;
}

// Auth types
export interface ChallengeResponse {
  nonce: string;
  message: string;
  expires_at: string;
}

// Wallet auth response — existing user gets full auth, new user gets registration token
export interface WalletAuthResponse {
  is_new: boolean;
  // Present for existing users:
  user?: User;
  profile?: Profile;
  access_token?: string;
  // Present for new users:
  registration_token?: string;
  wallet_pubkey?: string;
}

// Keep LoginResponse for backward compat (existing user login result)
export interface LoginResponse {
  is_new: boolean;
  user: User;
  profile: Profile;
  access_token: string;
}

// Registration request/response
export interface RegisterRequest {
  registration_token: string;
  username: string;
  display_name: string;
}

export interface RegisterResponse {
  user: User;
  profile: Profile;
  access_token: string;
}

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Commitment types
export type CommitmentStatus =
  | "pending"
  | "locked"
  | "active"
  | "resolving"
  | "released"
  | "cancelled";

export type CommitmentKind = "escrow_payment" | "screen_time_bet" | "challenge";

export interface Commitment {
  id: string;
  creator_id: string;
  opponent_id: string | null;
  kind: CommitmentKind;
  title: string;
  description: string | null;
  amount: number; // in lamports
  currency: string;
  status: CommitmentStatus;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
  updated_at: string;
  tx_deposit_creator: string | null;
  tx_deposit_opponent: string | null;
  tx_settle: string | null;
  winner_id: string | null;
  meta: CommitmentMeta | null;
}

export interface CommitmentMeta {
  app_name?: string;
  app_package_name?: string; // Android package name for screen time tracking
  time_limit_minutes?: number;
  [key: string]: unknown;
}

export interface CreateCommitmentRequest {
  kind: CommitmentKind;
  title: string;
  description?: string;
  amount: number; // in lamports
  currency: string;
  opponent_wallet?: string;
  start_at?: string;
  end_at?: string;
  meta?: CommitmentMeta;
}

export interface CommitmentsResponse {
  commitments: Commitment[];
  total: number;
}

// Transaction types (matches backend TxnKind)
export type TransactionKind =
  | "credit"
  | "debit"
  | "lock"
  | "release"
  | "refund"
  | "fee";

export interface Transaction {
  id: string;
  user_id: string;
  commitment_id: string | null;
  kind: TransactionKind;
  amount: number;
  currency: string;
  tx_signature: string | null;
  ref_id: string | null;
  meta: Record<string, any>;
  created_at: string;
}

export interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
}

export interface BalanceResponse {
  balance: number;
  currency: string;
  pending_stakes: number;
}

// API Error
export interface ApiError {
  error: string;
  message: string;
  status_code?: number;
}

// Helper types for display
export interface CommitmentDisplay {
  id: string;
  user: string;
  app: string;
  limit: string;
  amount: string;
  status: string;
  date: string;
  isMyBet: boolean;
}

export interface WalletSummary {
  totalBalance: number;
  stakeLoss: number;
  stakeReceived: number;
  totalCommitment: number;
  currency: string;
}

// Leaderboard types
export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  wallet_pubkey: string;
  total_wins: number;
  total_amount_won: number;
  win_streak: number;
}
