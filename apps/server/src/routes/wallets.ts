import { Router, Request, Response } from 'express';
import * as StellarSdk from '@stellar/stellar-sdk';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import path from 'path';

const router = Router();

// --- Encryption helpers ---
const ALGO = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY || 'default-dev-key-change-in-production!!';

function deriveKey(secret: string): Buffer {
    return crypto.scryptSync(secret, 'haloai-salt', 32);
}

function encrypt(text: string): string {
    const key = deriveKey(ENCRYPTION_KEY);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(data: string): string {
    const key = deriveKey(ENCRYPTION_KEY);
    const [ivHex, authTagHex, encryptedHex] = data.split(':');
    const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// --- SQLite setup ---
const dbPath = path.join(process.cwd(), 'wallets.db');
const db = new Database(dbPath);

db.exec(`
    CREATE TABLE IF NOT EXISTS wallets (
        privy_user_id TEXT PRIMARY KEY,
        public_key TEXT NOT NULL,
        encrypted_secret TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    )
`);

const stmtInsert = db.prepare(
    'INSERT INTO wallets (privy_user_id, public_key, encrypted_secret) VALUES (?, ?, ?)'
);
const stmtGet = db.prepare('SELECT * FROM wallets WHERE privy_user_id = ?');

console.log(`[Wallets] Database at ${dbPath}`);

// --- Stellar ---
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
        const existing = stmtGet.get(privyUserId) as any;
        if (existing) {
            const balance = await getBalance(existing.public_key);
            return res.json({ address: existing.public_key, balance });
        }

        // Generate new Stellar keypair
        const pair = StellarSdk.Keypair.random();
        const encryptedSecret = encrypt(pair.secret());

        stmtInsert.run(privyUserId, pair.publicKey(), encryptedSecret);
        console.log(`[Wallets] Created wallet for ${privyUserId}: ${pair.publicKey()}`);

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
        const wallet = stmtGet.get(userId) as any;

        if (!wallet) {
            return res.status(404).json({ error: 'Wallet not found' });
        }

        const balance = await getBalance(wallet.public_key);
        return res.json({ address: wallet.public_key, balance });
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

        const wallet = stmtGet.get(userId) as any;
        if (!wallet) {
            return res.status(404).json({ error: 'Wallet not found' });
        }

        const secretKey = decrypt(wallet.encrypted_secret);
        const sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);
        const account = await horizon.loadAccount(wallet.public_key);

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

        const balance = await getBalance(wallet.public_key);
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
