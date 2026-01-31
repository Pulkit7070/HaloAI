import { Router, Request, Response } from 'express';
import * as StellarSdk from '@stellar/stellar-sdk';

const router = Router();

// In-memory store mapping privyUserId -> Stellar keypair
const walletStore = new Map<string, { publicKey: string; secretKey: string }>();

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const horizon = new StellarSdk.Horizon.Server(HORIZON_URL);

// POST /api/wallets — create or return existing wallet
router.post('/', async (req: Request, res: Response) => {
    try {
        const { privyUserId } = req.body;
        if (!privyUserId) {
            return res.status(400).json({ error: 'privyUserId is required' });
        }

        // Return existing wallet if already created
        const existing = walletStore.get(privyUserId);
        if (existing) {
            const balance = await getBalance(existing.publicKey);
            return res.json({ address: existing.publicKey, balance });
        }

        // Generate new Stellar keypair
        const pair = StellarSdk.Keypair.random();
        walletStore.set(privyUserId, {
            publicKey: pair.publicKey(),
            secretKey: pair.secret(),
        });

        // Fund on testnet via friendbot
        try {
            await fetch(`https://friendbot.stellar.org?addr=${pair.publicKey()}`);
        } catch {
            // Friendbot may fail, wallet still created
        }

        const balance = await getBalance(pair.publicKey());
        return res.json({ address: pair.publicKey(), balance });
    } catch (err: any) {
        console.error('[Wallets] Create error:', err.message);
        return res.status(500).json({ error: 'Failed to create wallet' });
    }
});

// GET /api/wallets/:userId — get wallet info
router.get('/:userId', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const wallet = walletStore.get(userId);

        if (!wallet) {
            return res.status(404).json({ error: 'Wallet not found' });
        }

        const balance = await getBalance(wallet.publicKey);
        return res.json({ address: wallet.publicKey, balance });
    } catch (err: any) {
        console.error('[Wallets] Get error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch wallet' });
    }
});

// POST /api/wallets/:userId/send — send XLM
router.post('/:userId/send', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { to, amount } = req.body;

        if (!to || !amount) {
            return res.status(400).json({ error: 'to and amount are required' });
        }

        const wallet = walletStore.get(userId);
        if (!wallet) {
            return res.status(404).json({ error: 'Wallet not found' });
        }

        const sourceKeypair = StellarSdk.Keypair.fromSecret(wallet.secretKey);
        const account = await horizon.loadAccount(wallet.publicKey);

        const tx = new StellarSdk.TransactionBuilder(account, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: StellarSdk.Networks.TESTNET,
        })
            .addOperation(
                StellarSdk.Operation.payment({
                    destination: to,
                    asset: StellarSdk.Asset.native(),
                    amount: String(amount),
                })
            )
            .setTimeout(30)
            .build();

        tx.sign(sourceKeypair);
        const result = await horizon.submitTransaction(tx);

        const balance = await getBalance(wallet.publicKey);
        return res.json({ txHash: result.hash, balance });
    } catch (err: any) {
        console.error('[Wallets] Send error:', err.message);
        return res.status(500).json({ error: 'Failed to send XLM' });
    }
});

async function getBalance(publicKey: string): Promise<string> {
    try {
        const account = await horizon.loadAccount(publicKey);
        const native = account.balances.find(
            (b: any) => b.asset_type === 'native'
        );
        return native ? native.balance : '0';
    } catch {
        return '0';
    }
}

export { router as walletRouter };
