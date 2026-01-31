const WALLETS_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/wallets';

async function safeFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
    try {
        return await fetch(input, init);
    } catch (err) {
        // TypeError: Failed to fetch — network error / connection refused
        throw new Error('Connection error — is the server running?');
    }
}

async function parseErrorBody(res: Response): Promise<string> {
    try {
        const body = await res.json();
        return body.error || `Request failed (${res.status})`;
    } catch {
        return `Request failed (${res.status})`;
    }
}

export async function createWallet(privyUserId: string): Promise<{ address: string; balance: string }> {
    const res = await safeFetch(WALLETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privyUserId }),
    });
    if (!res.ok) throw new Error(await parseErrorBody(res));
    return res.json();
}

export async function getWallet(userId: string): Promise<{ address: string; balance: string }> {
    const res = await safeFetch(`${WALLETS_URL}/${userId}`);
    if (!res.ok) throw new Error(await parseErrorBody(res));
    return res.json();
}

export async function sendXLM(
    userId: string,
    to: string,
    amount: string
): Promise<{ txHash: string; balance: string }> {
    const res = await safeFetch(`${WALLETS_URL}/${userId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, amount }),
    });
    if (!res.ok) throw new Error(await parseErrorBody(res));
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
    const res = await safeFetch(`${WALLETS_URL}/${userId}/transactions`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.transactions;
}

export async function checkTrustline(userId: string): Promise<{ hasTrustline: boolean; balances: any[] }> {
    const res = await safeFetch(`${WALLETS_URL}/${userId}/trustlines`);
    if (!res.ok) throw new Error(await parseErrorBody(res));
    return res.json();
}

export async function addTrustline(userId: string): Promise<{ txHash: string; success: boolean }> {
    const res = await safeFetch(`${WALLETS_URL}/${userId}/trustline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(await parseErrorBody(res));
    return res.json();
}

export async function getSwapQuote(
    userId: string,
    amount: string
): Promise<{ destinationAmount: string; path: any[]; sourceAmount: string }> {
    const res = await safeFetch(`${WALLETS_URL}/${userId}/swap-quote?amount=${encodeURIComponent(amount)}`);
    if (!res.ok) {
        const errMsg = await parseErrorBody(res);
        throw new Error(errMsg);
    }
    return res.json();
}

export async function executeSwap(
    userId: string,
    amount: string,
    minDestAmount: string
): Promise<{ txHash: string; balance: string }> {
    const res = await safeFetch(`${WALLETS_URL}/${userId}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, minDestAmount }),
    });
    if (!res.ok) throw new Error(await parseErrorBody(res));
    return res.json();
}

export async function getHorizonAccount(address: string) {
    const res = await fetch(`https://horizon-testnet.stellar.org/accounts/${address}`);
    if (!res.ok) throw new Error('Failed to fetch account from Horizon');
    return res.json();
}
