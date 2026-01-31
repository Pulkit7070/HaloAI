import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';

export function useWallet() {
    const { ready, authenticated, user, createWallet: privyCreateWallet } = usePrivy();
    const { wallets } = useWallets();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Find the Privy embedded wallet
    const embeddedWallet = wallets.find(
        (w) => w.walletClientType === 'privy'
    );

    const address = embeddedWallet?.address ?? null;

    // Create embedded wallet via Privy if user doesn't have one
    const initWallet = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            await privyCreateWallet();
        } catch (err: any) {
            setError(err.message || 'Failed to create wallet');
        } finally {
            setIsLoading(false);
        }
    }, [privyCreateWallet]);

    // Reset error when auth state changes
    useEffect(() => {
        if (!authenticated) {
            setError(null);
        }
    }, [authenticated]);

    return {
        address,
        isLoading,
        error,
        initWallet,
        ready,
        authenticated,
    };
}
