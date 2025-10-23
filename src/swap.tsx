// src/swap.tsx
import React, { useEffect, useRef, useState } from 'react'
import { tokenStore } from './lib/secureStore'
import './swap-modal-responsive.css'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'

type SwapModalProps = {
    open: boolean
    onClose: () => void
    onChatEcho?: (text: string) => void
}

type BTCPrice = {
    price: number
    currency: string
    lastUpdated: string
}

type InitiateSwapRes = {
    success: boolean
    swapId: string
    reference: string
    btcAmount: number
    usdtAmount: number
    fee: number
    usdtAddress: string
    network: string
    expiresAt: string
    message?: string
}

const NETWORKS = [
    { code: 'ETH', label: 'Ethereum (ERC-20)' },
    { code: 'TRX', label: 'Tron (TRC-20)' },
    { code: 'BSC', label: 'BNB Smart Chain (BEP-20)' },
    { code: 'SOL', label: 'Solana' },
] as const

type NetworkCode = typeof NETWORKS[number]['code']

function getHeaders() {
    const { access } = tokenStore.getTokens()
    const h = new Headers()
    h.set('Content-Type', 'application/json')
    if (access) h.set('Authorization', `Bearer ${access}`)
    return h
}

function prettyAmount(n: number) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(n)
}

function prettyUsd(n: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}

function useCountdown(expiryIso?: string | null) {
    const [msLeft, setMsLeft] = useState<number>(() => {
        if (!expiryIso) return 0
        return Math.max(0, new Date(expiryIso).getTime() - Date.now())
    })

    useEffect(() => {
        if (!expiryIso) return
        const t = setInterval(() => {
            const left = Math.max(0, new Date(expiryIso).getTime() - Date.now())
            setMsLeft(left)
        }, 250)
        return () => clearInterval(t)
    }, [expiryIso])

    const mm = Math.floor(msLeft / 60000)
    const ss = Math.floor((msLeft % 60000) / 1000)
    return { msLeft, text: `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, expired: msLeft <= 0 }
}

function buildSwapRecap(init: InitiateSwapRes | null) {
    if (!init) return ''

    return [
        `Swap initiated successfully! 🔄`,
        `You'll receive: **${prettyAmount(init.usdtAmount)} USDT**`,
        `Network: **${init.network}**`,
        `Address: **${init.usdtAddress}**`,
        `Fee: **${prettyUsd(init.fee)}** (1.5%)`,
        `Expires: **${new Date(init.expiresAt).toLocaleString()}**`,
        '',
        `⚠️ Send exactly **${prettyAmount(init.btcAmount)} BTC** to complete the swap.`,
    ].join('\n')
}

export default function SwapModal({ open, onClose, onChatEcho }: SwapModalProps) {
    const [step, setStep] = useState<1 | 2>(1)

    // Step 1 (Swap Details)
    const [usdtAddress, setUsdtAddress] = useState('')
    const [network, setNetwork] = useState<NetworkCode>(NETWORKS[0].code)
    const [usdAmount, setUsdAmount] = useState<string>('100')
    const [currency, setCurrency] = useState<'USD' | 'NGN'>('USD')
    const [nairaAmount, setNairaAmount] = useState<string>('')
    const [initLoading, setInitLoading] = useState(false)
    const [initError, setInitError] = useState<string | null>(null)
    const [initData, setInitData] = useState<InitiateSwapRes | null>(null)

    // BTC Price
    const [btcPrice, setBtcPrice] = useState<BTCPrice | null>(null)
    const [priceLoading, setPriceLoading] = useState(false)
    const [priceError, setPriceError] = useState<string | null>(null)

    // Countdown
    const { text: countdown, expired } = useCountdown(initData?.expiresAt)

    // Reset on open
    useEffect(() => {
        if (!open) return
        setStep(1)
        setUsdtAddress('')
        setNetwork(NETWORKS[0].code)
        setUsdAmount('100')
        setCurrency('USD')
        setNairaAmount('')
        setInitLoading(false)
        setInitError(null)
        setInitData(null)
        setBtcPrice(null)
        setPriceLoading(false)
        setPriceError(null)
    }, [open])

    // Fetch BTC price on open
    useEffect(() => {
        if (!open) return
            ; (async () => {
                setPriceLoading(true)
                setPriceError(null)
                try {
                    const res = await fetch(`${API_BASE}/swap/btc-price`, {
                        method: 'GET',
                        headers: getHeaders(),
                        cache: 'no-store'
                    })

                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
                    }

                    const data = await res.json()

                    if (data.success && data.price) {
                        setBtcPrice(data)
                    } else {
                        throw new Error(data?.error || 'Invalid price data received')
                    }
                } catch (e: any) {
                    console.error('BTC price fetch error:', e)
                    setPriceError(e?.message || 'Failed to fetch BTC price')
                } finally {
                    setPriceLoading(false)
                }
            })()
    }, [open])

    // Esc to close
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    // Autofocus per step
    const firstInputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)
    useEffect(() => { firstInputRef.current?.focus() }, [step])

    async function submitInitiate(e: React.FormEvent) {
        e.preventDefault()
        setInitError(null)
        if (!usdtAddress.trim()) {
            setInitError('Enter your USDT receiving address')
            return
        }

        let finalUsdAmount = 0;

        if (currency === 'USD') {
            if (!usdAmount || isNaN(+usdAmount) || +usdAmount <= 0) {
                setInitError('Enter a valid USD amount')
                return
            }
            finalUsdAmount = +usdAmount;
        } else {
            if (!nairaAmount || isNaN(+nairaAmount) || +nairaAmount <= 0) {
                setInitError('Enter a valid Naira amount')
                return
            }

            // Convert Naira to USD
            try {
                const convertRes = await fetch(`${API_BASE}/swap/convert-naira`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({ nairaAmount: +nairaAmount }),
                })
                const convertData = await convertRes.json()
                if (!convertRes.ok || !convertData.success) {
                    throw new Error(convertData?.error || 'Failed to convert Naira amount')
                }
                finalUsdAmount = convertData.usdAmount;
            } catch (err: any) {
                setInitError(err.message || 'Failed to convert Naira amount')
                return
            }
        }

        if (finalUsdAmount > 10000) {
            setInitError('Maximum swap amount is $10,000')
            return
        }

        setInitLoading(true)
        try {
            const res = await fetch(`${API_BASE}/swap/initiate`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    usdtAddress: usdtAddress.trim(),
                    network,
                    usdAmount: finalUsdAmount
                }),
            })
            const data: InitiateSwapRes = await res.json()
            if (!res.ok || !data.success) throw new Error(data?.message || `HTTP ${res.status}`)
            setInitData(data)
            setStep(2)
        } catch (err: any) {
            setInitError(err.message || 'Failed to initiate swap')
        } finally {
            setInitLoading(false)
        }
    }

    const [copiedKey, setCopiedKey] = useState<string | null>(null)
    function copyToClipboard(text: string, key: string) {
        navigator.clipboard?.writeText(text).then(() => {
            setCopiedKey(key)
            setTimeout(() => setCopiedKey(null), 1200)
        }).catch(() => { })
    }

    if (!open) return null

    const headerTitle = step === 1 ? 'Start a Swap' : 'Swap Summary'

    return (
        <div className="swap-modal-overlay" onClick={onClose}>
            <div className="swap-modal-container" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="swap-modal-header">
                    <div className="swap-modal-title-row">
                        <div className="swap-modal-icon">🔄</div>
                        <div>
                            <h2 className="swap-modal-title">{headerTitle}</h2>
                            <div className="swap-modal-stepper">
                                <span className={`swap-modal-dot ${step === 1 ? 'active' : ''}`}></span> Step 1 — Details
                                <span className="swap-modal-dot-separator">•</span>
                                <span className={`swap-modal-dot ${step === 2 ? 'active' : ''}`}></span> Step 2 — Summary
                            </div>
                        </div>
                    </div>
                    <button type="button" className="swap-modal-close" onClick={onClose}>✕</button>
                </div>

                {/* Body */}
                <div className="swap-modal-body">
                    {/* STEP 1 — Swap Details */}
                    {step === 1 && (
                        <div className="swap-modal-section">
                            <p className="swap-modal-description">
                                Enter your USDT blockchain address and amount. We'll create a Lightning invoice for you to pay with BTC, then swap to USDT on your chosen network.
                            </p>

                            <div className="swap-modal-warning">
                                ⚠️ Maximum swap amount: $10,000 worth of BTC
                            </div>

                            {/* BTC Price Display */}
                            {btcPrice && (
                                <div className="swap-modal-price-card">
                                    <div className="swap-modal-price-title">Current BTC Price</div>
                                    <div className="swap-modal-price-value">
                                        {prettyUsd(btcPrice.price)} USD
                                    </div>
                                    <div className="swap-modal-price-updated">
                                        Updated: {new Date(btcPrice.lastUpdated).toLocaleTimeString()}
                                    </div>
                                </div>
                            )}

                            {priceError && (
                                <div className="swap-modal-error">
                                    <strong>Price Error:</strong> {priceError}
                                </div>
                            )}

                            {!!initError && (
                                <div className="swap-modal-error">
                                    <strong>Error:</strong> {initError}
                                </div>
                            )}

                            <form onSubmit={submitInitiate} className="swap-modal-form">
                                <label className="swap-modal-input-wrap">
                                    <span className="swap-modal-label">USDT Receiving Address</span>
                                    <input
                                        ref={firstInputRef as any}
                                        className="swap-modal-input"
                                        placeholder="Enter your USDT blockchain address"
                                        value={usdtAddress}
                                        onChange={e => setUsdtAddress(e.target.value)}
                                    />
                                </label>

                                <label className="swap-modal-input-wrap">
                                    <span className="swap-modal-label">Network</span>
                                    <div className="swap-modal-select-wrapper">
                                        <select
                                            className="swap-modal-input"
                                            value={network}
                                            onChange={e => setNetwork(e.target.value as NetworkCode)}
                                        >
                                            {NETWORKS.map(n => (
                                                <option key={n.code} value={n.code}>{n.label}</option>
                                            ))}
                                        </select>
                                        <div className="swap-modal-dropdown-arrow">▼</div>
                                    </div>
                                </label>

                                <label className="swap-modal-input-wrap">
                                    <span className="swap-modal-label">Currency</span>
                                    <div className="swap-modal-select-wrapper">
                                        <select
                                            className="swap-modal-input"
                                            value={currency}
                                            onChange={e => setCurrency(e.target.value as 'USD' | 'NGN')}
                                        >
                                            <option value="USD">USD</option>
                                            <option value="NGN">NGN (Naira)</option>
                                        </select>
                                        <div className="swap-modal-dropdown-arrow">▼</div>
                                    </div>
                                </label>

                                {currency === 'USD' ? (
                                    <label className="swap-modal-input-wrap full-width">
                                        <span className="swap-modal-label">Amount (USD)</span>
                                        <input
                                            className="swap-modal-input"
                                            inputMode="decimal"
                                            placeholder="e.g. 100"
                                            value={usdAmount}
                                            onChange={e => setUsdAmount(e.target.value)}
                                        />
                                    </label>
                                ) : (
                                    <label className="swap-modal-input-wrap full-width">
                                        <span className="swap-modal-label">Amount (NGN)</span>
                                        <input
                                            className="swap-modal-input"
                                            inputMode="decimal"
                                            placeholder="e.g. 150000"
                                            value={nairaAmount}
                                            onChange={e => setNairaAmount(e.target.value)}
                                        />
                                    </label>
                                )}

                                <div className="swap-modal-fee-info">
                                    <div className="swap-modal-fee-title">Fee: 1.5%</div>
                                    <div className="swap-modal-fee-description">
                                        Lightning Network fees apply for fast BTC processing
                                    </div>
                                </div>

                                <div className="swap-modal-button-row">
                                    <button className="swap-modal-button primary" disabled={initLoading || priceLoading}>
                                        {initLoading ? 'Creating Swap...' : 'Create Swap'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* STEP 2 — Swap Summary */}
                    {step === 2 && initData && (
                        <div className="swap-modal-section">
                            <div className="swap-modal-success-card">
                                <div className="swap-modal-success-header">
                                    <h3 className="swap-modal-card-title">Swap Details</h3>
                                    <div className="swap-modal-countdown">
                                        ⏱ {expired ? 'Expired' : countdown} <span>remaining</span>
                                    </div>
                                </div>

                                <div className="swap-modal-grid">
                                    <div>
                                        <div className="swap-modal-key">Swap ID</div>
                                        <div className="swap-modal-value mono">{initData.swapId}</div>
                                    </div>
                                    <div>
                                        <div className="swap-modal-key">Reference</div>
                                        <div className="swap-modal-value mono">{initData.reference}</div>
                                    </div>
                                    <div>
                                        <div className="swap-modal-key">You'll Receive</div>
                                        <div className="swap-modal-value">
                                            {prettyAmount(initData.usdtAmount)} USDT
                                        </div>
                                    </div>
                                    <div>
                                        <div className="swap-modal-key">Network</div>
                                        <div className="swap-modal-value">{initData.network}</div>
                                    </div>
                                    <div>
                                        <div className="swap-modal-key">Fee</div>
                                        <div className="swap-modal-value">{prettyUsd(initData.fee)} (1.5%)</div>
                                    </div>
                                    <div>
                                        <div className="swap-modal-key">USDT Address</div>
                                        <div className="swap-modal-value mono wrap">
                                            {initData.usdtAddress}
                                        </div>
                                        <div className="swap-modal-button-row">
                                            <button
                                                className="swap-modal-button outline"
                                                onClick={() => copyToClipboard(initData.usdtAddress, 'usdt-addr')}
                                            >
                                                {copiedKey === 'usdt-addr' ? 'Copied ✓' : 'Copy Address'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="swap-modal-warning">
                                    ⚠️ Send exactly {prettyAmount(initData.btcAmount)} BTC to complete the swap before the timer expires.
                                </div>

                                <div className="swap-modal-button-row">
                                    <button className="swap-modal-button primary" onClick={() => {
                                        onChatEcho?.(buildSwapRecap(initData))
                                        onClose()
                                    }}>
                                        Done
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="swap-modal-footer">
                    <div className="swap-modal-footer-text">
                        {step === 1
                            ? 'Enter your USDT blockchain address and amount to create a Lightning invoice.'
                            : 'Send the exact BTC amount to complete your swap to USDT.'}
                    </div>
                    <div className="swap-modal-button-row">
                        {step === 2 ? (
                            <button className="swap-modal-button outline" onClick={() => setStep(1)}>← Back</button>
                        ) : (
                            <button className="swap-modal-button outline" onClick={onClose}>Cancel</button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
