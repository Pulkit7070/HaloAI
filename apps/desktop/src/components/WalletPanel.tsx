import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useWallet } from '../hooks/useWallet';
import WalletSendForm from './WalletSendForm';

interface WalletPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function WalletPanel({ isOpen, onClose }: WalletPanelProps) {
    const { ready, authenticated, login, logout } = useAuth();
    const { address, balance, isLoading, error, sendState, initWallet, send, refreshBalance, resetSendState } = useWallet();
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    const copyAddress = async () => {
        if (!address) return;
        await navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const truncatedAddress = address
        ? `${address.slice(0, 6)}...${address.slice(-4)}`
        : null;

    return (
        <div
            className="fixed inset-0 flex items-center justify-center animate-fade-in"
            style={{
                zIndex: 999999,
                pointerEvents: 'auto',
                WebkitAppRegion: 'no-drag',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(4px)',
            } as any}
            onClick={handleBackdropClick}
            onMouseDown={handleBackdropClick}
        >
            <div
                style={{
                    position: 'relative',
                    background: 'rgba(10, 10, 12, 0.9)',
                    backdropFilter: 'blur(30px)',
                    borderRadius: '1rem',
                    padding: '1.5rem',
                    width: '460px',
                    maxWidth: '90vw',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08)',
                    pointerEvents: 'auto',
                    WebkitAppRegion: 'no-drag',
                    zIndex: 1000000,
                } as any}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="animate-scale-in"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/5 rounded-lg border border-white/5">
                            <svg className="w-4 h-4 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-medium text-white/90 tracking-wide">Wallet</h2>
                    </div>
                    <button
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="force-clickable text-white/40 hover:text-white/80 transition-colors p-1"
                        style={{ pointerEvents: 'auto', cursor: 'pointer', WebkitAppRegion: 'no-drag', zIndex: 10001 } as any}
                        type="button"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ pointerEvents: 'none' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="space-y-6">
                    {!ready && (
                        <div className="flex justify-center py-8">
                            <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                        </div>
                    )}

                    {/* State 1: Not authenticated */}
                    {ready && !authenticated && (
                        <div className="text-center space-y-4 py-4">
                            <p className="text-white/40 text-sm font-light">Sign in to access your Stellar wallet.</p>
                            <button
                                onClick={login}
                                className="w-full px-4 py-3 bg-white text-black rounded-xl font-medium text-sm hover:bg-white/90 shadow-lg shadow-white/5 transition-all"
                                style={{ pointerEvents: 'auto', WebkitAppRegion: 'no-drag' } as any}
                                type="button"
                            >
                                Sign In
                            </button>
                        </div>
                    )}

                    {/* State 2: Authenticated, no wallet */}
                    {ready && authenticated && !address && !isLoading && (
                        <div className="text-center space-y-4 py-4">
                            <p className="text-white/40 text-sm font-light">Create a Stellar wallet to send and receive XLM.</p>
                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/10 rounded-lg">
                                    <p className="text-red-300 text-xs">{error}</p>
                                </div>
                            )}
                            <button
                                onClick={initWallet}
                                className="w-full px-4 py-3 bg-white text-black rounded-xl font-medium text-sm hover:bg-white/90 shadow-lg shadow-white/5 transition-all"
                                style={{ pointerEvents: 'auto', WebkitAppRegion: 'no-drag' } as any}
                                type="button"
                            >
                                Create Stellar Wallet
                            </button>
                        </div>
                    )}

                    {/* Loading state */}
                    {ready && authenticated && isLoading && !address && (
                        <div className="flex justify-center py-8">
                            <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                        </div>
                    )}

                    {/* State 3: Wallet exists */}
                    {ready && authenticated && address && (
                        <>
                            {/* Address */}
                            <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                                <div>
                                    <span className="text-xs text-white/40 font-light block mb-1">Address</span>
                                    <span className="text-sm text-white/80 font-mono">{truncatedAddress}</span>
                                </div>
                                <button
                                    onClick={copyAddress}
                                    className="text-white/40 hover:text-white/80 transition-colors p-1.5 rounded-md hover:bg-white/5"
                                    title="Copy address"
                                    type="button"
                                    style={{ pointerEvents: 'auto', WebkitAppRegion: 'no-drag' } as any}
                                >
                                    {copied ? (
                                        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    )}
                                </button>
                            </div>

                            {/* Balance */}
                            <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                                <div>
                                    <span className="text-xs text-white/40 font-light block mb-1">Balance</span>
                                    <span className="text-lg text-white/90 font-medium">{balance ?? '—'} <span className="text-sm text-white/40">XLM</span></span>
                                </div>
                                <button
                                    onClick={refreshBalance}
                                    disabled={isLoading}
                                    className="text-white/40 hover:text-white/80 transition-colors p-1.5 rounded-md hover:bg-white/5"
                                    title="Refresh balance"
                                    type="button"
                                    style={{ pointerEvents: 'auto', WebkitAppRegion: 'no-drag' } as any}
                                >
                                    <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                            </div>

                            {/* Send Form */}
                            <div>
                                <label className="block text-sm font-medium text-white/80 mb-3">Send XLM</label>
                                <WalletSendForm onSend={send} sendState={sendState} onReset={resetSendState} />
                            </div>

                            {/* Sign Out */}
                            <div className="flex justify-center pt-2">
                                <button
                                    onClick={logout}
                                    className="force-clickable text-xs text-white/20 hover:text-white/50 transition-colors"
                                    style={{ pointerEvents: 'auto', cursor: 'pointer', WebkitAppRegion: 'no-drag' } as any}
                                    type="button"
                                >
                                    Sign Out
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
