import { API_URL } from "@/constants/config";
import type {
  ChallengeResponse,
  LoginResponse,
  MeResponse,
  UserWithProfile,
  Profile,
  Commitment,
  CommitmentsResponse,
  CreateCommitmentRequest,
  Transaction,
  TransactionsResponse,
  BalanceResponse,
  ApiError,
} from "@/types";

class ApiService {
  private accessToken: string | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${API_URL}${endpoint}`;
    console.log(`[API] ${options.method || "GET"} ${url}`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    try {
      console.log("[API] Sending request...");
      const response = await fetch(url, {
        ...options,
        headers,
      });
      console.log(`[API] Response status: ${response.status}`);

      // Handle empty responses
      const text = await response.text();
      let data: any = null;

      if (text) {
        try {
          data = JSON.parse(text);
          console.log(
            "[API] Response data:",
            JSON.stringify(data).substring(0, 200),
          );
        } catch {
          console.log("[API] Response is not JSON:", text.substring(0, 100));
        }
      }

      if (!response.ok) {
        const error = data as ApiError;
        console.error("[API] Error response:", error || text);
        throw new Error(
          error?.message ||
            error?.error ||
            `Request failed with status ${response.status}`,
        );
      }

      return data as T;
    } catch (err: any) {
      console.error("[API] Request failed:", err.message);
      throw err;
    }
  }

  // ==================== Health ====================
  async health(): Promise<{ status: string; version: string }> {
    return this.request("/health");
  }

  // ==================== Auth ====================
  async requestChallenge(walletPubkey: string): Promise<ChallengeResponse> {
    return this.request("/auth/challenge", {
      method: "POST",
      body: JSON.stringify({ wallet_pubkey: walletPubkey }),
    });
  }

  async walletLogin(
    walletPubkey: string,
    walletLabel: string | null,
    nonce: string,
    signature: string,
  ): Promise<LoginResponse> {
    return this.request("/auth/wallet", {
      method: "POST",
      body: JSON.stringify({
        wallet_pubkey: walletPubkey,
        wallet_label: walletLabel,
        nonce,
        signature,
      }),
    });
  }

  // ==================== Profile ====================
  async getMe(): Promise<MeResponse> {
    return this.request("/me");
  }

  async setUsername(username: string): Promise<Profile> {
    return this.request("/me/username", {
      method: "PATCH",
      body: JSON.stringify({ username }),
    });
  }

  async updateProfile(data: {
    display_name?: string;
    avatar_url?: string;
    bio?: string;
  }): Promise<Profile> {
    return this.request("/me/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async checkUsername(username: string): Promise<{ available: boolean }> {
    return this.request(
      `/username/check?username=${encodeURIComponent(username)}`,
    );
  }

  // ==================== Commitments ====================
  async createCommitment(data: CreateCommitmentRequest): Promise<Commitment> {
    const response = await this.request<{ commitment: Commitment }>(
      "/commitments",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
    return response.commitment;
  }

  async getCommitments(limit = 20, offset = 0): Promise<CommitmentsResponse> {
    return this.request(`/commitments?limit=${limit}&offset=${offset}`);
  }

  async getOpenChallenges(
    limit = 20,
    offset = 0,
  ): Promise<CommitmentsResponse> {
    return this.request(`/commitments/open?limit=${limit}&offset=${offset}`);
  }

  async getCommitment(id: string): Promise<Commitment> {
    const response = await this.request<{ commitment: Commitment }>(
      `/commitments/${id}`,
    );
    return response.commitment;
  }

  async joinCommitment(id: string): Promise<Commitment> {
    const response = await this.request<{ commitment: Commitment }>(
      `/commitments/${id}/join`,
      {
        method: "POST",
      },
    );
    return response.commitment;
  }

  async recordDeposit(id: string, txSignature: string): Promise<Commitment> {
    const response = await this.request<{ commitment: Commitment }>(
      `/commitments/${id}/deposit`,
      {
        method: "POST",
        body: JSON.stringify({ tx_signature: txSignature }),
      },
    );
    return response.commitment;
  }

  async cancelCommitment(id: string): Promise<Commitment> {
    const response = await this.request<{ commitment: Commitment }>(
      `/commitments/${id}/cancel`,
      {
        method: "POST",
      },
    );
    return response.commitment;
  }

  async getCommitmentTransactions(id: string): Promise<Transaction[]> {
    return this.request(`/commitments/${id}/transactions`);
  }

  // ==================== Transactions ====================
  async getTransactions(limit = 20, offset = 0): Promise<TransactionsResponse> {
    return this.request(`/transactions?limit=${limit}&offset=${offset}`);
  }

  async getTransaction(id: string): Promise<Transaction> {
    return this.request(`/transactions/${id}`);
  }

  async getBalance(currency = "SOL"): Promise<BalanceResponse> {
    return this.request(`/balance?currency=${encodeURIComponent(currency)}`);
  }

  // ==================== Users (for searching opponents) ====================
  async searchUsers(query: string): Promise<{ users: UserWithProfile[] }> {
    return this.request(`/users/search?q=${encodeURIComponent(query)}`);
  }

  async getUserByWallet(walletPubkey: string): Promise<UserWithProfile | null> {
    try {
      return await this.request(`/users/wallet/${walletPubkey}`);
    } catch {
      return null;
    }
  }

  async getUserByUsername(username: string): Promise<UserWithProfile | null> {
    try {
      return await this.request(
        `/users/username/${encodeURIComponent(username)}`,
      );
    } catch {
      return null;
    }
  }

  // ==================== Leaderboard ====================
  async getLeaderboard(
    timeframe: "week" | "month" | "all" = "week",
  ): Promise<any[]> {
    return this.request(`/leaderboard?timeframe=${timeframe}`);
  }

  // ==================== Commitment Actions ====================
  async activateCommitment(
    commitmentId: string,
  ): Promise<{ commitment: Commitment }> {
    return this.request(`/commitments/${commitmentId}/activate`, {
      method: "POST",
    });
  }

  async settleCommitment(
    commitmentId: string,
    winnerId: string,
    txSettle: string,
  ): Promise<{ commitment: Commitment }> {
    return this.request(`/commitments/${commitmentId}/settle`, {
      method: "POST",
      body: JSON.stringify({
        winner_id: winnerId,
        tx_settle: txSettle,
      }),
    });
  }

  async checkAndSettle(
    commitmentId: string,
    appUsageMinutes: number,
  ): Promise<{
    commitment: Commitment;
    settled: boolean;
    winner_id: string | null;
    reason: string;
  }> {
    return this.request(`/commitments/${commitmentId}/check-and-settle`, {
      method: "POST",
      body: JSON.stringify({ app_usage_minutes: appUsageMinutes }),
    });
  }
}

// Export singleton instance
export const api = new ApiService();

// Export helper functions for common operations
export function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000;
}

export function solToLamports(sol: number): number {
  return Math.floor(sol * 1_000_000_000);
}

export function formatSol(lamports: number, decimals = 4): string {
  return `${lamportsToSol(lamports).toFixed(decimals)} SOL`;
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "pending":
      return "text-yellow-400";
    case "locked":
      return "text-orange-400";
    case "active":
      return "text-blue-400";
    case "resolving":
      return "text-purple-400";
    case "released":
    case "win":
    case "received":
    case "safe":
      return "text-green-400";
    case "cancelled":
    case "loss":
      return "text-red-400";
    default:
      return "text-gray-400";
  }
}
