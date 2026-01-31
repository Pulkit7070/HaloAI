import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { createWallet, getWallet, sendXLM } from '../services/walletApi';

interface SendState {
    status: 'idle' | 'loading' | 'success' | 'error';
    txHash?: string;
    error?: string;
}

export function useWallet() {
    const { userId, authenticated } = useAuth();
    const [address, setAddress] = useState<string | null>(null);
    const [balance, setBalance] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sendState, setSendState] = useState<SendState>({ status: 'idle' });

    const fetchWallet = useCallback(async () => {
        if (!userId) return;
        setIsLoading(true);
        setError(null);
        try {
            const wallet = await getWallet(userId);
            setAddress(wallet.address);
            setBalance(wallet.balance);
        } catch (err: any) {
            if (err.message?.includes('not found') || err.message?.includes('404')) {
                setAddress(null);
                setBalance(null);
            } else {
                setError(err.message || 'Failed to fetch wallet');
            }
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        if (authenticated && userId) {
            fetchWallet();
        } else {
            setAddress(null);
            setBalance(null);
            setError(null);
        }
    }, [authenticated, userId, fetchWallet]);

    const initWallet = useCallback(async () => {
        if (!userId) return;
        setIsLoading(true);
        setError(null);
        try {
            const wallet = await createWallet(userId);
            setAddress(wallet.address);
            setBalance(wallet.balance);
        } catch (err: any) {
            setError(err.message || 'Failed to create wallet');
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    const send = useCallback(async (to: string, amount: string) => {
        if (!userId) return;
        setSendState({ status: 'loading' });
        try {
            const result = await sendXLM(userId, to, amount);
            setBalance(result.balance);
            setSendState({ status: 'success', txHash: result.txHash });
        } catch (err: any) {
            setSendState({ status: 'error', error: err.message || 'Failed to send XLM' });
        }
    }, [userId]);

    const refreshBalance = useCallback(async () => {
        await fetchWallet();
    }, [fetchWallet]);

    const resetSendState = useCallback(() => {
        setSendState({ status: 'idle' });
    }, []);

    return {
        address,
        balance,
        isLoading,
        error,
        sendState,
        initWallet,
        send,
        refreshBalance,
        resetSendState,
    };
}
