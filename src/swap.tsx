// src/swap.tsx
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { tokenStore } from './lib/secureStore'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'

type SwapModalProps = {
    open: boolean
    onClose: () => void
    onChatEcho?: (text: string) => void
}

const TOKENS = ['USDT', 'USDC', 'BTC', 'ETH', 'SOL', 'BNB', 'MATIC', 'AVAX'] as const
type TokenSym = typeof TOKENS[number]

function getHeaders() {
    const { access } = tokenStore.getTokens()
    const h = new Headers()
    h.set('Content-Type', 'application/json')
    if (access) h.set('Authorization', `Bearer ${access}`)
    return h
}

function prettyAmount(n: number) {
    return new Intl.NumberFormat('en-NG', { maximumFractionDigits: 8 }).format(n)
}

function prettyNgn(n: number) {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(n)
}

export default function SwapModal({ open, onClose, onChatEcho }: SwapModalProps) {
    const [fromToken, setFromToken] = useState<TokenSym>('USDT')
    const [toToken, setToToken] = useState<TokenSym>('BTC')
    const [amount, setAmount] = useState<string>('100')
    const [swapType, setSwapType] = useState<'onramp' | 'offramp'>('offramp')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [quote, setQuote] = useState<any>(null)

    // Reset on open
    useEffect(() => {
        if (!open) return
        setFromToken('USDT')
        setToToken('BTC')
        setAmount('100')
        setSwapType('offramp')
        setLoading(false)
        setError(null)
        setQuote(null)
    }, [open])

    // Esc to close
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    async function getQuote() {
        if (!amount || isNaN(+amount) || +amount <= 0) {
            setError('Enter a valid amount')
            return
        }

        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`${API_BASE}/swap/quote`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    fromToken,
                    toToken,
                    amount: +amount,
                    type: swapType
                }),
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data?.error || `HTTP ${res.status}`)
            setQuote(data.quote)
        } catch (err: any) {
            setError(err.message || 'Failed to get quote')
        } finally {
            setLoading(false)
        }
    }

    async function executeSwap() {
        if (!quote) return

        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`${API_BASE}/swap/execute`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    fromToken: quote.fromToken,
                    toToken: quote.toToken,
                    fromAmount: quote.fromAmount,
                    toAmount: quote.toAmount,
                    rate: quote.rate,
                    type: quote.type
                }),
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data?.error || `HTTP ${res.status}`)

            onChatEcho?.(`Swap executed successfully! ${prettyAmount(quote.fromAmount)} ${quote.fromToken} → ${prettyAmount(quote.toAmount)} ${quote.toToken}`)
            onClose()
        } catch (err: any) {
            setError(err.message || 'Failed to execute swap')
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null

    return createPortal(
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.55)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 1000
        }} role="dialog" aria-modal="true" onClick={onClose}>
            <div style={{
                width: '100%',
                maxWidth: 500,
                background: 'var(--card)',
                color: 'var(--txt)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                boxShadow: 'var(--shadow)',
                overflow: 'hidden',
                display: 'grid',
                gridTemplateRows: 'auto 1fr auto',
                animation: 'scaleIn 120ms ease-out'
            }} onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div style={{
                    padding: '16px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#0d1512', display: 'grid', placeItems: 'center', border: '1px solid var(--border)' }}>
                            🔄
                        </div>
                        <div>
                            <div style={{ fontWeight: 700 }}>Token Swap</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Exchange between tokens</div>
                        </div>
                    </div>
                    <button type="button" aria-label="Close" style={{
                        appearance: 'none',
                        border: '1px solid var(--border)',
                        background: 'transparent',
                        color: 'var(--muted)',
                        padding: '10px 14px',
                        borderRadius: 10,
                        cursor: 'pointer'
                    }} onClick={onClose}>✕</button>
                </div>

                {/* Body */}
                <div style={{ padding: 18, overflow: 'auto' }}>
                    <div style={{ display: 'grid', gap: 14 }}>
                        <p style={{ margin: 0, color: 'var(--muted)' }}>
                            Choose tokens and amount to get a quote.
                        </p>

                        {!!error && (
                            <div role="alert" style={{
                                border: '1px solid rgba(220, 50, 50, .25)',
                                borderRadius: 12,
                                padding: 14,
                                background: 'rgba(220, 50, 50, .1)'
                            }}>
                                <strong style={{ color: '#ffaaaa' }}>Error:</strong> {error}
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <label style={{ display: 'grid', gap: 6 }}>
                                <span style={{ fontSize: 12, color: 'var(--muted)' }}>From Token</span>
                                <select
                                    style={{
                                        background: '#0f1117',
                                        color: 'var(--txt)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 10,
                                        padding: '10px 12px',
                                        outline: 'none'
                                    }}
                                    value={fromToken}
                                    onChange={e => setFromToken(e.target.value as TokenSym)}
                                >
                                    {TOKENS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </label>

                            <label style={{ display: 'grid', gap: 6 }}>
                                <span style={{ fontSize: 12, color: 'var(--muted)' }}>To Token</span>
                                <select
                                    style={{
                                        background: '#0f1117',
                                        color: 'var(--txt)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 10,
                                        padding: '10px 12px',
                                        outline: 'none'
                                    }}
                                    value={toToken}
                                    onChange={e => setToToken(e.target.value as TokenSym)}
                                >
                                    {TOKENS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </label>

                            <label style={{ display: 'grid', gap: 6 }}>
                                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Amount</span>
                                <input
                                    style={{
                                        background: '#0f1117',
                                        color: 'var(--txt)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 10,
                                        padding: '10px 12px',
                                        outline: 'none'
                                    }}
                                    inputMode="decimal"
                                    placeholder="e.g. 100"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                />
                            </label>

                            <label style={{ display: 'grid', gap: 6 }}>
                                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Type</span>
                                <select
                                    style={{
                                        background: '#0f1117',
                                        color: 'var(--txt)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 10,
                                        padding: '10px 12px',
                                        outline: 'none'
                                    }}
                                    value={swapType}
                                    onChange={e => setSwapType(e.target.value as 'onramp' | 'offramp')}
                                >
                                    <option value="offramp">Crypto to NGN</option>
                                    <option value="onramp">NGN to Crypto</option>
                                </select>
                            </label>
                        </div>

                        {quote && (
                            <div style={{
                                border: '1px solid var(--border)',
                                borderRadius: 12,
                                padding: 14,
                                background: '#0e0f15',
                                display: 'grid',
                                gap: 10
                            }}>
                                <h3 style={{ margin: 0, fontSize: 16 }}>Quote</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>You Send</div>
                                        <div style={{ fontWeight: 600 }}>
                                            {prettyAmount(quote.fromAmount)} {quote.fromToken}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>You Receive</div>
                                        <div style={{ fontWeight: 600 }}>
                                            {prettyAmount(quote.toAmount)} {quote.toToken}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Rate</div>
                                        <div style={{ fontWeight: 600 }}>
                                            {prettyAmount(quote.rate)} {quote.toToken}/{quote.fromToken}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            {!quote ? (
                                <button
                                    style={{
                                        appearance: 'none',
                                        border: 'none',
                                        background: 'var(--accent)',
                                        color: 'white',
                                        padding: '10px 14px',
                                        borderRadius: 10,
                                        cursor: 'pointer'
                                    }}
                                    disabled={loading}
                                    onClick={getQuote}
                                >
                                    {loading ? 'Getting Quote...' : 'Get Quote'}
                                </button>
                            ) : (
                                <button
                                    style={{
                                        appearance: 'none',
                                        border: 'none',
                                        background: 'var(--accent)',
                                        color: 'white',
                                        padding: '10px 14px',
                                        borderRadius: 10,
                                        cursor: 'pointer'
                                    }}
                                    disabled={loading}
                                    onClick={executeSwap}
                                >
                                    {loading ? 'Executing...' : 'Execute Swap'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    borderTop: '1px solid var(--border)',
                    background: 'linear-gradient(180deg, transparent, rgba(0,0,0,.05))'
                }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {!quote ? 'Get a quote to see exchange rates.' : 'Review the quote before executing.'}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            style={{
                                appearance: 'none',
                                border: '1px solid var(--border)',
                                background: 'transparent',
                                color: 'var(--txt)',
                                padding: '10px 14px',
                                borderRadius: 10,
                                cursor: 'pointer'
                            }}
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>

            {/* Tiny animation keyframes */}
            <style>
                {`@keyframes scaleIn{from{transform:translateY(8px) scale(.98); opacity:.0} to{transform:none; opacity:1}}`}
            </style>
        </div>,
        document.body
    )
}
