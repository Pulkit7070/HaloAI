const WALLETS_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/wallets';

export async function createWallet(privyUserId: string): Promise<{ address: string; balance: string }> {
    const res = await fetch(WALLETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privyUserId }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to create wallet');
    return res.json();
}

export async function getWallet(userId: string): Promise<{ address: string; balance: string }> {
    const res = await fetch(`${WALLETS_URL}/${userId}`);
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch wallet');
    return res.json();
}

export async function sendXLM(
    userId: string,
    to: string,
    amount: string
): Promise<{ txHash: string; balance: string }> {
    const res = await fetch(`${WALLETS_URL}/${userId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, amount }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to send XLM');
    return res.json();
}

export interface Transaction {
    id: string;
    type: 'sent' | 'received';
    amount: string;
    asset: string;
    from: string;
    to: string;
    date: string;
    txHash: string;
}

export async function getTransactions(userId: string): Promise<Transaction[]> {
    const res = await fetch(`${WALLETS_URL}/${userId}/transactions`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.transactions;
}

export async function getHorizonAccount(address: string) {
    const res = await fetch(`https://horizon-testnet.stellar.org/accounts/${address}`);
    if (!res.ok) throw new Error('Failed to fetch account from Horizon');
    return res.json();
}
