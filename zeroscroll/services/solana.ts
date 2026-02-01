// Solana Balance Service - Fetch on-chain SOL balance
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

// Solana RPC endpoints
const SOLANA_RPC_ENDPOINTS = {
  mainnet: "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
  // You can also use custom RPC providers like:
  // helius: "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY",
  // quicknode: "https://your-endpoint.solana-mainnet.quiknode.pro/YOUR_KEY",
};

// Default to devnet for testing, change to mainnet for production
const DEFAULT_NETWORK: keyof typeof SOLANA_RPC_ENDPOINTS = "devnet";

export interface SolanaBalance {
  lamports: number;
  sol: number;
  formatted: string;
}

export interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  uiAmount: number;
  symbol?: string;
}

class SolanaBalanceService {
  private connection: Connection;
  private network: keyof typeof SOLANA_RPC_ENDPOINTS;

  constructor(network: keyof typeof SOLANA_RPC_ENDPOINTS = DEFAULT_NETWORK) {
    this.network = network;
    this.connection = new Connection(
      SOLANA_RPC_ENDPOINTS[network],
      "confirmed",
    );
  }

  /**
   * Set the network (mainnet, devnet)
   */
  setNetwork(network: keyof typeof SOLANA_RPC_ENDPOINTS) {
    this.network = network;
    this.connection = new Connection(
      SOLANA_RPC_ENDPOINTS[network],
      "confirmed",
    );
    console.log(`[Solana] Switched to ${network}`);
  }

  /**
   * Get the current network
   */
  getNetwork(): string {
    return this.network;
  }

  /**
   * Get SOL balance for a wallet address
   * @param walletAddress The wallet's public key as base58 string
   */
  async getBalance(walletAddress: string): Promise<SolanaBalance> {
    try {
      console.log(
        `[Solana] Fetching balance for ${walletAddress} on ${this.network}`,
      );

      const publicKey = new PublicKey(walletAddress);
      const lamports = await this.connection.getBalance(publicKey);
      const sol = lamports / LAMPORTS_PER_SOL;

      console.log(`[Solana] Balance: ${sol} SOL (${lamports} lamports)`);

      return {
        lamports,
        sol,
        formatted: this.formatSol(sol),
      };
    } catch (error: any) {
      console.error("[Solana] Error fetching balance:", error.message);
      throw error;
    }
  }

  /**
   * Get all token balances for a wallet (SPL tokens)
   * @param walletAddress The wallet's public key as base58 string
   */
  async getTokenBalances(walletAddress: string): Promise<TokenBalance[]> {
    try {
      console.log(`[Solana] Fetching token balances for ${walletAddress}`);

      const publicKey = new PublicKey(walletAddress);
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        publicKey,
        {
          programId: new PublicKey(
            "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          ),
        },
      );

      const balances: TokenBalance[] = tokenAccounts.value.map((account) => {
        const parsedInfo = account.account.data.parsed.info;
        return {
          mint: parsedInfo.mint,
          amount: parseInt(parsedInfo.tokenAmount.amount),
          decimals: parsedInfo.tokenAmount.decimals,
          uiAmount: parsedInfo.tokenAmount.uiAmount || 0,
        };
      });

      console.log(`[Solana] Found ${balances.length} token accounts`);
      return balances;
    } catch (error: any) {
      console.error("[Solana] Error fetching token balances:", error.message);
      return [];
    }
  }

  /**
   * Request airdrop (devnet only)
   * @param walletAddress The wallet's public key as base58 string
   * @param amount Amount in SOL (max 2 SOL per request on devnet)
   */
  async requestAirdrop(
    walletAddress: string,
    amount: number = 1,
  ): Promise<string> {
    if (this.network !== "devnet") {
      throw new Error("Airdrop is only available on devnet");
    }

    try {
      console.log(
        `[Solana] Requesting ${amount} SOL airdrop for ${walletAddress}`,
      );

      const publicKey = new PublicKey(walletAddress);
      const lamports = amount * LAMPORTS_PER_SOL;

      const signature = await this.connection.requestAirdrop(
        publicKey,
        lamports,
      );

      // Wait for confirmation
      await this.connection.confirmTransaction(signature);

      console.log(`[Solana] Airdrop successful! Signature: ${signature}`);
      return signature;
    } catch (error: any) {
      console.error("[Solana] Airdrop failed:", error.message);
      throw error;
    }
  }

  /**
   * Format SOL amount to display string
   */
  formatSol(sol: number): string {
    if (sol >= 1000) {
      return `${(sol / 1000).toFixed(2)}K SOL`;
    }
    if (sol >= 1) {
      return `${sol.toFixed(4)} SOL`;
    }
    if (sol >= 0.001) {
      return `${sol.toFixed(6)} SOL`;
    }
    return `${sol.toFixed(9)} SOL`;
  }

  /**
   * Convert lamports to SOL
   */
  lamportsToSol(lamports: number): number {
    return lamports / LAMPORTS_PER_SOL;
  }

  /**
   * Convert SOL to lamports
   */
  solToLamports(sol: number): number {
    return Math.floor(sol * LAMPORTS_PER_SOL);
  }

  /**
   * Check if address is valid
   */
  isValidAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get recent blockhash (useful for transactions)
   */
  async getRecentBlockhash(): Promise<string> {
    const { blockhash } = await this.connection.getLatestBlockhash();
    return blockhash;
  }

  /**
   * Subscribe to balance changes
   */
  subscribeToBalance(
    walletAddress: string,
    callback: (balance: SolanaBalance) => void,
  ): number {
    const publicKey = new PublicKey(walletAddress);

    return this.connection.onAccountChange(publicKey, (accountInfo) => {
      const lamports = accountInfo.lamports;
      const sol = lamports / LAMPORTS_PER_SOL;
      callback({
        lamports,
        sol,
        formatted: this.formatSol(sol),
      });
    });
  }

  /**
   * Unsubscribe from balance changes
   */
  async unsubscribeFromBalance(subscriptionId: number): Promise<void> {
    await this.connection.removeAccountChangeListener(subscriptionId);
  }
}

// Export singleton instance
export const solanaService = new SolanaBalanceService();
export default solanaService;
