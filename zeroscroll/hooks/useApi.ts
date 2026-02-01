import { useState, useEffect, useCallback } from "react";
import { api } from "@/services/api";
import type { Commitment, BalanceResponse, Transaction } from "@/types";

/**
 * Hook to fetch and manage user's commitments
 */
export function useCommitments(limit = 20, offset = 0) {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommitments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getCommitments(limit, offset);
      setCommitments(data.commitments);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message || "Failed to fetch commitments");
    } finally {
      setLoading(false);
    }
  }, [limit, offset]);

  useEffect(() => {
    fetchCommitments();
  }, [fetchCommitments]);

  return {
    commitments,
    total,
    loading,
    error,
    refetch: fetchCommitments,
  };
}

/**
 * Hook to fetch user's balance
 */
export function useBalance(currency = "SOL") {
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getBalance(currency);
      setBalance(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch balance");
    } finally {
      setLoading(false);
    }
  }, [currency]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return {
    balance,
    loading,
    error,
    refetch: fetchBalance,
  };
}

/**
 * Hook to fetch user's transactions
 */
export function useTransactions(limit = 20, offset = 0) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getTransactions(limit, offset);
      setTransactions(data.transactions);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message || "Failed to fetch transactions");
    } finally {
      setLoading(false);
    }
  }, [limit, offset]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions,
    total,
    loading,
    error,
    refetch: fetchTransactions,
  };
}

/**
 * Hook for a single commitment
 */
export function useCommitment(id: string | null) {
  const [commitment, setCommitment] = useState<Commitment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommitment = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await api.getCommitment(id);
      setCommitment(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch commitment");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCommitment();
  }, [fetchCommitment]);

  return {
    commitment,
    loading,
    error,
    refetch: fetchCommitment,
  };
}

/**
 * Hook to check username availability
 */
export function useUsernameCheck(username: string, delay = 500) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!username || username.length < 3) {
      setAvailable(null);
      return;
    }

    // Validate format
    const validFormat = /^[a-zA-Z0-9_]{3,20}$/.test(username);
    if (!validFormat) {
      setAvailable(false);
      return;
    }

    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const result = await api.checkUsername(username);
        setAvailable(result.available);
      } catch {
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [username, delay]);

  return { available, checking };
}
