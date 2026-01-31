import { Router, Request, Response } from 'express';
import * as StellarSdk from '@stellar/stellar-sdk';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

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

// --- Supabase setup ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('[Wallets] SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
console.log(`[Wallets] Connected to Supabase at ${supabaseUrl}`);

// --- Stellar ---
const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const horizon = new StellarSdk.Horizon.Server(HORIZON_URL);

// USDC on testnet
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const USDC_ASSET = new StellarSdk.Asset('USDC', USDC_ISSUER);

// POST /api/wallets — create or return existing wallet
router.post('/', async (req: Request, res: Response) => {
    try {
        const { privyUserId } = req.body;
        if (!privyUserId) {
            return res.status(400).json({ error: 'privyUserId is required' });
        }

        // Return existing wallet if already created
        const { data: existing } = await supabase
            .from('wallets')
            .select('*')
            .eq('privy_user_id', privyUserId)
            .limit(1)
            .maybeSingle();

        if (existing) {
            const balance = await getBalance(existing.public_key);
            return res.json({ address: existing.public_key, balance });
        }

        // Generate new Stellar keypair
        const pair = StellarSdk.Keypair.random();
        const encryptedSecret = encrypt(pair.secret());

        const { error: insertError } = await supabase
            .from('wallets')
            .insert({
                privy_user_id: privyUserId,
                public_key: pair.publicKey(),
                encrypted_secret: encryptedSecret,
            });

        if (insertError) {
            throw insertError;
        }

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
        const { data: wallet } = await supabase
            .from('wallets')
            .select('*')
            .eq('privy_user_id', userId)
            .limit(1)
            .maybeSingle();

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

        const { data: wallet } = await supabase
            .from('wallets')
            .select('*')
            .eq('privy_user_id', userId)
            .limit(1)
            .maybeSingle();

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

// GET /api/wallets/:userId/transactions — get transaction history
router.get('/:userId/transactions', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { data: wallet } = await supabase
            .from('wallets')
            .select('*')
            .eq('privy_user_id', userId)
            .limit(1)
            .maybeSingle();

        if (!wallet) {
            return res.status(404).json({ error: 'Wallet not found' });
        }

        const payments = await horizon
            .payments()
            .forAccount(wallet.public_key)
            .order('desc')
            .limit(20)
            .call();

        const validTypes = ['payment', 'create_account', 'path_payment_strict_send', 'path_payment_strict_receive'];
        const transactions = payments.records
            .filter((r: any) => validTypes.includes(r.type))
            .map((r: any) => {
                if (r.type === 'create_account') {
                    return {
                        id: r.id,
                        type: 'received',
                        amount: r.starting_balance,
                        asset: 'XLM',
                        from: r.source_account,
                        to: r.account,
                        date: r.created_at,
                        txHash: r.transaction_hash,
                    };
                }
                if (r.type === 'path_payment_strict_send' || r.type === 'path_payment_strict_receive') {
                    return {
                        id: r.id,
                        type: 'trade',
                        amount: r.amount,
                        asset: r.asset_type === 'native' ? 'XLM' : r.asset_code,
                        sourceAsset: r.source_asset_type === 'native' ? 'XLM' : r.source_asset_code,
                        sourceAmount: r.source_amount,
                        from: r.from,
                        to: r.to,
                        date: r.created_at,
                        txHash: r.transaction_hash,
                    };
                }
                const isSent = r.from === wallet.public_key;
                return {
                    id: r.id,
                    type: isSent ? 'sent' : 'received',
                    amount: r.amount,
                    asset: r.asset_type === 'native' ? 'XLM' : r.asset_code,
                    from: r.from,
                    to: r.to,
                    date: r.created_at,
                    txHash: r.transaction_hash,
                };
            });

        return res.json({ transactions });
    } catch (err: any) {
        console.error('[Wallets] Transactions error:', err.message);
        return res.json({ transactions: [] });
    }
});

// GET /api/wallets/:userId/trustlines — check USDC trustline
router.get('/:userId/trustlines', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { data: wallet } = await supabase
            .from('wallets')
            .select('*')
            .eq('privy_user_id', userId)
            .limit(1)
            .maybeSingle();

        if (!wallet) {
            return res.status(404).json({ error: 'Wallet not found' });
        }

        const account = await horizon.loadAccount(wallet.public_key);
        const hasTrustline = account.balances.some(
            (b: any) => b.asset_type === 'credit_alphanum4' && b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER
        );
        return res.json({ hasTrustline, balances: account.balances });
    } catch (err: any) {
        console.error('[Wallets] Trustline check error:', err.message);
        return res.status(500).json({ error: 'Failed to check trustlines' });
    }
});

// POST /api/wallets/:userId/trustline — add USDC trustline
router.post('/:userId/trustline', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { data: wallet } = await supabase
            .from('wallets')
            .select('*')
            .eq('privy_user_id', userId)
            .limit(1)
            .maybeSingle();

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
            .addOperation(StellarSdk.Operation.changeTrust({ asset: USDC_ASSET }))
            .setTimeout(30)
            .build();

        tx.sign(sourceKeypair);
        const result = await horizon.submitTransaction(tx);

        return res.json({ txHash: result.hash, success: true });
    } catch (err: any) {
        console.error('[Wallets] Trustline add error:', err.message);
        return res.status(500).json({ error: 'Failed to add USDC trustline' });
    }
});

// GET /api/wallets/:userId/swap-quote — get XLM→USDC quote
router.get('/:userId/swap-quote', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { amount } = req.query;

        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            return res.status(400).json({ error: 'Valid amount is required' });
        }

        const { data: wallet } = await supabase
            .from('wallets')
            .select('*')
            .eq('privy_user_id', userId)
            .limit(1)
            .maybeSingle();

        if (!wallet) {
            return res.status(404).json({ error: 'Wallet not found' });
        }

        const paths = await horizon
            .strictSendPaths(StellarSdk.Asset.native(), String(amount), [USDC_ASSET])
            .call();

        if (!paths.records || paths.records.length === 0) {
            return res.status(404).json({ error: 'No swap path found for this amount' });
        }

        // Pick the best (highest destination_amount)
        const best = paths.records.reduce((a: any, b: any) =>
            parseFloat(a.destination_amount) >= parseFloat(b.destination_amount) ? a : b
        );

        return res.json({
            destinationAmount: best.destination_amount,
            path: best.path,
            sourceAmount: best.source_amount,
        });
    } catch (err: any) {
        console.error('[Wallets] Swap quote error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch swap quote' });
    }
});

// POST /api/wallets/:userId/swap — execute XLM→USDC swap
router.post('/:userId/swap', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { amount, minDestAmount } = req.body;

        if (!amount || !minDestAmount) {
            return res.status(400).json({ error: 'amount and minDestAmount are required' });
        }

        const { data: wallet } = await supabase
            .from('wallets')
            .select('*')
            .eq('privy_user_id', userId)
            .limit(1)
            .maybeSingle();

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
                StellarSdk.Operation.pathPaymentStrictSend({
                    sendAsset: StellarSdk.Asset.native(),
                    sendAmount: String(amount),
                    destination: wallet.public_key, // swap to self
                    destAsset: USDC_ASSET,
                    destMin: String(minDestAmount),
                    path: [], // let network find best route
                })
            )
            .setTimeout(30)
            .build();

        tx.sign(sourceKeypair);
        const result = await horizon.submitTransaction(tx);

        const balance = await getBalance(wallet.public_key);
        return res.json({ txHash: result.hash, balance });
    } catch (err: any) {
        console.error('[Wallets] Swap error:', err.message);
        const msg = err?.response?.data?.extras?.result_codes
            ? JSON.stringify(err.response.data.extras.result_codes)
            : 'Failed to execute swap';
        return res.status(500).json({ error: msg });
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