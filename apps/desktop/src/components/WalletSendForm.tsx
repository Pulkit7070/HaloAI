import { useState } from 'react';

interface WalletSendFormProps {
    onSend: (to: string, amount: string) => Promise<void>;
    sendState: {
        status: 'idle' | 'loading' | 'success' | 'error';
        txHash?: string;
        error?: string;
    };
    onReset: () => void;
}

export default function WalletSendForm({ onSend, sendState, onReset }: WalletSendFormProps) {
    const [to, setTo] = useState('');
    const [amount, setAmount] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!to.trim() || !amount.trim()) return;
        await onSend(to.trim(), amount.trim());
        setTo('');
        setAmount('');
    };

    if (sendState.status === 'success') {
        return (
            <div className="space-y-3">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/10 rounded-lg">
                    <p className="text-emerald-300 text-xs font-medium mb-1">Transaction sent</p>
                    <p className="text-emerald-300/70 text-[11px] font-mono break-all">
                        {sendState.txHash}
                    </p>
                </div>
                <button
                    onClick={onReset}
                    className="w-full px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] rounded-xl text-white/80 text-sm transition-all"
                    type="button"
                >
                    Send Another
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-xs text-white/40 mb-1.5 font-light">Destination Address</label>
                <input
                    type="text"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="G..."
                    disabled={sendState.status === 'loading'}
                    className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/20 transition-colors font-mono"
                />
            </div>
            <div>
                <label className="block text-xs text-white/40 mb-1.5 font-light">Amount (XLM)</label>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="any"
                    min="0"
                    disabled={sendState.status === 'loading'}
                    className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/20 transition-colors"
                />
            </div>

            {sendState.status === 'error' && (
                <div className="p-3 bg-red-500/10 border border-red-500/10 rounded-lg">
                    <p className="text-red-300 text-xs">{sendState.error}</p>
                </div>
            )}

            <button
                type="submit"
                disabled={!to.trim() || !amount.trim() || sendState.status === 'loading'}
                className={`w-full px-4 py-3 rounded-xl font-medium transition-all text-sm ${
                    !to.trim() || !amount.trim() || sendState.status === 'loading'
                        ? 'bg-white/5 text-white/30 cursor-not-allowed'
                        : 'bg-white text-black hover:bg-white/90 shadow-lg shadow-white/5'
                }`}
                style={{ pointerEvents: 'auto', WebkitAppRegion: 'no-drag' } as any}
            >
                {sendState.status === 'loading' ? 'Sending...' : 'Send XLM'}
            </button>
        </form>
    );
}
