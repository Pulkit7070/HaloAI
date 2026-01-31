import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { createWallet, getWallet, sendXLM, getTransactions, checkTrustline, addTrustline, getSwapQuote, executeSwap, getVaultBalance, vaultDeposit, vaultWithdraw, vaultLock } from '../services/walletApi';
import type { Transaction } from '../services/walletApi';

interface SendState {
    status: 'idle' | 'loading' | 'success' | 'error';
    txHash?: string;
    error?: string;
}

interface TradeState {
    status: 'idle' | 'quoting' | 'quoted' | 'swapping' | 'success' | 'error';
    quote?: string;
    txHash?: string;
    error?: string;
}

interface VaultState {
    status: 'idle' | 'loading' | 'success' | 'error';
    txHash?: string;
    error?: string;
    lockId?: number | null;
}

export function useWallet() {
    const { userId, authenticated } = useAuth();
    const [address, setAddress] = useState<string | null>(null);
    const [balance, setBalance] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sendState, setSendState] = useState<SendState>({ status: 'idle' });
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [txLoading, setTxLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // Ref to guard against state updates in fire-and-forget callbacks (send, initWallet)
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // Main data-fetching effect — only depends on primitive userId + refreshKey
    useEffect(() => {
        if (!authenticated || !userId) {
            setAddress(null);
            setBalance(null);
            setError(null);
            setTransactions([]);
            return;
        }

        let cancelled = false;

        async function load() {
            setIsLoading(true);
            setError(null);
            let walletAddress: string | null = null;

            try {
                const wallet = await getWallet(userId!);
                if (!cancelled) {
                    setAddress(wallet.address);
                    setBalance(wallet.balance);
                    walletAddress = wallet.address;
                }
            } catch (err: any) {
                if (!cancelled) {
                    console.error('[useWallet] fetchWallet error:', err);
                    if (err.message?.includes('not found') || err.message?.includes('404')) {
                        setAddress(null);
                        setBalance(null);
                    } else {
                        setError(err.message || 'Failed to fetch wallet');
                    }
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }

            // Fetch transactions (falls back to direct Horizon if backend is offline)
            try {
                if (!cancelled) setTxLoading(true);
                const txs = await getTransactions(userId!, walletAddress ?? undefined);
                if (!cancelled) setTransactions(txs);
            } catch (err: any) {
                if (!cancelled) {
                    console.error('[useWallet] fetchTransactions error:', err);
                    setTransactions([]);
                }
            } finally {
                if (!cancelled) setTxLoading(false);
            }
        }

        load();

        return () => { cancelled = true; };
    }, [userId, authenticated, refreshKey]);

    const refresh = useCallback(() => {
        setRefreshKey(k => k + 1);
    }, []);

    const initWallet = useCallback(async () => {
        if (!userId) return;
        setIsLoading(true);
        setError(null);
        try {
            const wallet = await createWallet(userId);
            if (!mountedRef.current) return;
            setAddress(wallet.address);
            setBalance(wallet.balance);
            // Trigger a refresh to load transactions
            setRefreshKey(k => k + 1);
        } catch (err: any) {
            if (!mountedRef.current) return;
            console.error('[useWallet] initWallet error:', err);
            setError(err.message || 'Failed to create wallet');
        } finally {
            if (mountedRef.current) setIsLoading(false);
        }
    }, [userId]);

    const send = useCallback(async (to: string, amount: string) => {
        if (!userId) return;
        setSendState({ status: 'loading' });
        try {
            const result = await sendXLM(userId, to, amount);
            if (!mountedRef.current) return;
            setBalance(result.balance);
            setSendState({ status: 'success', txHash: result.txHash });
            // Refresh transactions after send
            setRefreshKey(k => k + 1);
        } catch (err: any) {
            if (!mountedRef.current) return;
            console.error('[useWallet] send error:', err);
            setSendState({ status: 'error', error: err.message || 'Failed to send XLM' });
        }
    }, [userId]);

    const resetSendState = useCallback(() => {
        setSendState({ status: 'idle' });
    }, []);

    // --- Trade / Swap state ---
    const [tradeState, setTradeState] = useState<TradeState>({ status: 'idle' });
    const [hasTrustline, setHasTrustline] = useState<boolean | null>(null);
    const [trustlineLoading, setTrustlineLoading] = useState(false);

    const checkUsdcTrustline = useCallback(async () => {
        if (!userId) return;
        setTrustlineLoading(true);
        try {
            const result = await checkTrustline(userId);
            if (mountedRef.current) setHasTrustline(result.hasTrustline);
        } catch (err: any) {
            if (mountedRef.current) {
                console.error('[useWallet] trustline check error:', err);
                setHasTrustline(false);
            }
        } finally {
            if (mountedRef.current) setTrustlineLoading(false);
        }
    }, [userId]);

    const enableTrustline = useCallback(async () => {
        if (!userId) return;
        setTrustlineLoading(true);
        try {
            await addTrustline(userId);
            if (mountedRef.current) setHasTrustline(true);
        } catch (err: any) {
            if (mountedRef.current) {
                console.error('[useWallet] enable trustline error:', err);
                setTradeState({ status: 'error', error: err.message || 'Failed to enable USDC trustline' });
            }
        } finally {
            if (mountedRef.current) setTrustlineLoading(false);
        }
    }, [userId]);

    const fetchQuote = useCallback(async (amount: string) => {
        if (!userId) return;
        setTradeState({ status: 'quoting' });
        try {
            const result = await getSwapQuote(userId, amount);
            if (mountedRef.current) {
                setTradeState({ status: 'quoted', quote: result.destinationAmount });
            }
        } catch (err: any) {
            if (mountedRef.current) {
                setTradeState({ status: 'error', error: err.message || 'Failed to get quote' });
            }
        }
    }, [userId]);

    const swap = useCallback(async (amount: string, minDestAmount: string) => {
        if (!userId) return;
        setTradeState(prev => ({ ...prev, status: 'swapping' }));
        try {
            const result = await executeSwap(userId, amount, minDestAmount);
            if (mountedRef.current) {
                setBalance(result.balance);
                setTradeState({ status: 'success', txHash: result.txHash });
                setRefreshKey(k => k + 1);
            }
        } catch (err: any) {
            if (mountedRef.current) {
                setTradeState({ status: 'error', error: err.message || 'Swap failed' });
            }
        }
    }, [userId]);

    const resetTradeState = useCallback(() => {
        setTradeState({ status: 'idle' });
    }, []);

    // --- Vault state ---
    const [vaultBalance, setVaultBalance] = useState<string | null>(null);
    const [vaultLoading, setVaultLoading] = useState(false);
    const [vaultState, setVaultState] = useState<VaultState>({ status: 'idle' });

    const refreshVaultBalance = useCallback(async () => {
        if (!userId) return;
        setVaultLoading(true);
        try {
            const result = await getVaultBalance(userId);
            if (mountedRef.current) setVaultBalance(result.balance);
        } catch (err: any) {
            if (mountedRef.current) {
                console.error('[useWallet] vault balance error:', err);
                setVaultBalance('0');
            }
        } finally {
            if (mountedRef.current) setVaultLoading(false);
        }
    }, [userId]);

    const depositToVault = useCallback(async (amount: string) => {
        if (!userId) return;
        setVaultState({ status: 'loading' });
        try {
            const result = await vaultDeposit(userId, amount);
            if (!mountedRef.current) return;
            setBalance(result.balance);
            setVaultState({ status: 'success' });
            refreshVaultBalance();
        } catch (err: any) {
            if (!mountedRef.current) return;
            setVaultState({ status: 'error', error: err.message || 'Deposit failed' });
        }
    }, [userId, refreshVaultBalance]);

    const withdrawFromVault = useCallback(async (amount: string) => {
        if (!userId) return;
        setVaultState({ status: 'loading' });
        try {
            const result = await vaultWithdraw(userId, amount);
            if (!mountedRef.current) return;
            setBalance(result.balance);
            setVaultState({ status: 'success' });
            refreshVaultBalance();
        } catch (err: any) {
            if (!mountedRef.current) return;
            setVaultState({ status: 'error', error: err.message || 'Withdraw failed' });
        }
    }, [userId, refreshVaultBalance]);

    const lockInVault = useCallback(async (amount: string, expiresAtLedger: number) => {
        if (!userId) return;
        setVaultState({ status: 'loading' });
        try {
            const result = await vaultLock(userId, amount, expiresAtLedger);
            if (!mountedRef.current) return;
            setVaultState({ status: 'success', lockId: result.lockId });
            refreshVaultBalance();
        } catch (err: any) {
            if (!mountedRef.current) return;
            setVaultState({ status: 'error', error: err.message || 'Lock failed' });
        }
    }, [userId, refreshVaultBalance]);

    const resetVaultState = useCallback(() => {
        setVaultState({ status: 'idle' });
    }, []);

    return {
        address,
        balance,
        isLoading,
        error,
        sendState,
        transactions,
        txLoading,
        initWallet,
        send,
        refresh,
        resetSendState,
        // Trade
        tradeState,
        hasTrustline,
        trustlineLoading,
        checkUsdcTrustline,
        enableTrustline,
        fetchQuote,
        swap,
        resetTradeState,
        // Vault
        vaultBalance,
        vaultLoading,
        vaultState,
        refreshVaultBalance,
        depositToVault,
        withdrawFromVault,
        lockInVault,
        resetVaultState,
    };
}
