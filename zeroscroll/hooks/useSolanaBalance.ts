import { useState, useEffect, useCallback, useRef } from "react";
import { solanaService, SolanaBalance } from "@/services/solana";

export interface UseSolanaBalanceResult {
  balance: SolanaBalance | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  requestAirdrop: (amount?: number) => Promise<string | null>;
  network: string;
  setNetwork: (network: "mainnet" | "devnet") => void;
}

export function useSolanaBalance(
  walletAddress: string | null,
): UseSolanaBalanceResult {
  const [balance, setBalance] = useState<SolanaBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [network, setNetworkState] = useState(solanaService.getNetwork());
  const subscriptionId = useRef<number | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!walletAddress) {
      setBalance(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log(`[useSolanaBalance] Fetching balance for ${walletAddress}`);
      const bal = await solanaService.getBalance(walletAddress);
      setBalance(bal);
      console.log(`[useSolanaBalance] Balance: ${bal.formatted}`);
    } catch (err: any) {
      console.error("[useSolanaBalance] Error:", err.message);
      setError(err.message || "Failed to fetch balance");
      setBalance(null);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  const setNetwork = useCallback(
    (net: "mainnet" | "devnet") => {
      solanaService.setNetwork(net);
      setNetworkState(net);
      // Refetch balance on network change
      fetchBalance();
    },
    [fetchBalance],
  );

  const requestAirdrop = useCallback(
    async (amount: number = 1) => {
      if (!walletAddress) {
        setError("No wallet connected");
        return null;
      }

      try {
        setIsLoading(true);
        setError(null);

        const signature = await solanaService.requestAirdrop(
          walletAddress,
          amount,
        );

        // Refresh balance after airdrop
        await fetchBalance();

        return signature;
      } catch (err: any) {
        setError(err.message || "Airdrop failed");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [walletAddress, fetchBalance],
  );

  // Subscribe to balance changes
  useEffect(() => {
    if (!walletAddress) return;

    // Initial fetch
    fetchBalance();

    // Subscribe to changes
    try {
      subscriptionId.current = solanaService.subscribeToBalance(
        walletAddress,
        (newBalance) => {
          console.log(
            `[useSolanaBalance] Balance changed: ${newBalance.formatted}`,
          );
          setBalance(newBalance);
        },
      );
    } catch (err) {
      console.error("[useSolanaBalance] Failed to subscribe:", err);
    }

    // Cleanup
    return () => {
      if (subscriptionId.current !== null) {
        solanaService
          .unsubscribeFromBalance(subscriptionId.current)
          .catch(console.error);
        subscriptionId.current = null;
      }
    };
  }, [walletAddress, fetchBalance]);

  return {
    balance,
    isLoading,
    error,
    refresh: fetchBalance,
    requestAirdrop,
    network,
    setNetwork,
  };
}

export default useSolanaBalance;
