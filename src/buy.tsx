// src/buy.tsx
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { tokenStore } from './lib/secureStore'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'

type BuyModalProps = {
  open: boolean
  onClose: () => void
  onChatEcho?: (text: string) => void
}

const TOKENS = ['USDT','USDC','BTC','ETH','SOL','BNB','MATIC','AVAX'] as const
type TokenSym = typeof TOKENS[number]

const NETWORKS_BY_TOKEN: Record<TokenSym, { code: string; label: string }[]> = {
  BTC:   [{ code: 'BTC', label: 'Bitcoin' }],
  ETH:   [{ code: 'ETH', label: 'Ethereum' }],
  SOL:   [{ code: 'SOL', label: 'Solana' }],
  BNB:   [{ code: 'BSC', label: 'BNB Smart Chain' }],
  MATIC: [{ code: 'ETH', label: 'Ethereum (ERC-20)' }],
  AVAX:  [{ code: 'BSC', label: 'BNB Smart Chain' }],
  USDT:  [
    { code: 'ETH', label: 'Ethereum (ERC-20)' },
    { code: 'TRX', label: 'Tron (TRC-20)' },
    { code: 'BSC', label: 'BNB Smart Chain (BEP-20)' },
  ],
  USDC:  [
    { code: 'ETH', label: 'Ethereum (ERC-20)' },
    { code: 'BSC', label: 'BNB Smart Chain (BEP-20)' },
  ],
}

type InitiateBuyRes = {
  success: boolean
  paymentId: string
  reference: string
  token: string
  network: string
  buyAmount: number
  delivery: {
    walletAddress: string
    network: string
    token: string
    amount: number
  }
  quote: {
    rate: number              // NGN per token
    receiveCurrency: string   // token symbol
    receiveAmount: number     // token amount
    tokenAmount: number
    expiresAt: string
    breakdown?: any
  }
  payment: {
    url: string
    amount: number
    currency: 'NGN'
    reference: string
    status: string
  }
  message?: string
}

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

function toNetworkLabel(token: string, code: string) {
  const t = (token || '').toUpperCase() as TokenSym
  const list = NETWORKS_BY_TOKEN[t]
  const hit = list?.find(n => n.code === (code || '').toUpperCase())
  return hit?.label || code
}

/* ===== Minimal inline modal styles (match sell.tsx) ===== */
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 1000 }
const sheetStyle: React.CSSProperties = { width: '100%', maxWidth: 760, background: 'var(--card)', color: 'var(--txt)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow)', overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto 1fr auto', animation: 'scaleIn 120ms ease-out' }
const headerStyle: React.CSSProperties = { padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }
const titleRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 }
const bodyStyle: React.CSSProperties = { padding: 18, overflow: 'auto' }
const footerStyle: React.CSSProperties = { padding: 16, display: 'flex', justifyContent: 'space-between', gap: 12, borderTop: '1px solid var(--border)', background: 'linear-gradient(180deg, transparent, rgba(0,0,0,.05))' }
const btn: React.CSSProperties = { appearance: 'none', border: '1px solid var(--border)', background: 'transparent', color: 'var(--txt)', padding: '10px 14px', borderRadius: 10, cursor: 'pointer' }
const btnPrimary: React.CSSProperties = { ...btn, border: 'none', background: 'var(--accent)', color: 'white' }
const btnDangerGhost: React.CSSProperties = { ...btn, borderColor: 'var(--border)', color: 'var(--muted)' }
const gridForm: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
const inputWrap: React.CSSProperties = { display: 'grid', gap: 6 }
const labelText: React.CSSProperties = { fontSize: 12, color: 'var(--muted)' }
const inputBase: React.CSSProperties = { background: '#0f1117', color: 'var(--txt)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', outline: 'none' }
const errorBanner: React.CSSProperties = { border: '1px solid rgba(220, 50, 50, .25)', borderRadius: 12, padding: 14, background: 'rgba(220, 50, 50, .1)' }
const card: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: 14, background: '#0e0f15', display: 'grid', gap: 10 }
const smallMuted: React.CSSProperties = { fontSize: 12, color: 'var(--muted)' }
const mono: React.CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }

export default function BuyModal({ open, onClose, onChatEcho }: BuyModalProps) {
  // Form fields
  const [token, setToken] = useState<TokenSym>('USDT')
  const [network, setNetwork] = useState(NETWORKS_BY_TOKEN['USDT'][0].code)
  const [buyAmount, setBuyAmount] = useState<string>('5000') // NGN
  const [walletAddress, setWalletAddress] = useState<string>('')

  // UX
  const [initLoading, setInitLoading] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)

  // Reset when opened
  useEffect(() => {
    if (!open) return
    setToken('USDT')
    setNetwork(NETWORKS_BY_TOKEN['USDT'][0].code)
    setBuyAmount('5000')
    setWalletAddress('')
    setInitLoading(false)
    setInitError(null)
    setRedirectUrl(null)
  }, [open])

  // Keep network valid on token change
  useEffect(() => {
    const list = NETWORKS_BY_TOKEN[token]
    if (!list.find(n => n.code === network)) setNetwork(list[0].code)
  }, [token])

  // Close on ESC
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const firstInputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)
  useEffect(() => { firstInputRef.current?.focus() }, [open])

  function buildChatEcho(data: InitiateBuyRes) {
    return [
      `Buy started ✅`,
      `You’re paying **${prettyNgn(data.buyAmount)}**.`,
      `You’ll receive **${prettyAmount(data.quote.tokenAmount)} ${data.token}** to **${data.delivery.walletAddress}** on **${toNetworkLabel(data.token, data.network)}**.`,
      `Rate: **${prettyAmount(data.quote.rate)} NGN/${data.token}**.`,
      ``,
      `Opening payment page now…`
    ].join('\n')
  }

  async function submitInitiate(e: React.FormEvent) {
    e.preventDefault()
    setInitError(null)

    const amt = +buyAmount
    if (!amt || !isFinite(amt) || amt <= 0) {
      setInitError('Enter a valid NGN amount')
      return
    }
    if (!walletAddress || walletAddress.trim().length < 6) {
      setInitError('Enter a valid wallet address')
      return
    }

    setInitLoading(true)
    try {
      const res = await fetch(`${API_BASE}/buy/initiate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ token, network, walletAddress: walletAddress.trim(), buyAmount: amt }),
      })
      const data: InitiateBuyRes = await res.json()
      if (!res.ok || !data.success) throw new Error(data?.message || `HTTP ${res.status}`)

      const url =
        (data as any)?.payment?.url ||
        (data as any)?.paymentUrl ||
        (data as any)?.url

      if (!url) throw new Error('Payment URL missing from response')

      // Optional: echo a recap into your chat pane
      onChatEcho?.(buildChatEcho(data))

      setRedirectUrl(url)

      // Try navigating in the same tab for reliability
      try {
        window.location.assign(url)
      } catch {
        // Fallback to opening in a new tab
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    } catch (err: any) {
      setInitError(err?.message || 'Failed to initiate buy')
    } finally {
      setInitLoading(false)
    }
  }

  if (!open) return null

  return createPortal(
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="buy-title" onClick={onClose}>
      <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={titleRowStyle}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#0d1512', display: 'grid', placeItems: 'center', border: '1px solid var(--border)' }}>
              🛒
            </div>
            <div>
              <div id="buy-title" style={{ fontWeight: 700 }}>Start a Buy</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Enter purchase details and we’ll take you to the payment page.
              </div>
            </div>
          </div>
          <button type="button" aria-label="Close" style={btnDangerGhost} onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div style={bodyStyle}>
          {!!initError && (
            <div role="alert" style={errorBanner}>
              <strong style={{ color: '#ffaaaa' }}>Error:</strong> {initError}
            </div>
          )}

          <form onSubmit={submitInitiate} style={gridForm}>
            <label style={inputWrap}>
              <span style={labelText}>Token</span>
              <select
                ref={firstInputRef as any}
                style={inputBase}
                value={token}
                onChange={e => setToken(e.target.value as TokenSym)}
              >
                {TOKENS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>

            <label style={inputWrap}>
              <span style={labelText}>Network</span>
              <select
                style={inputBase}
                value={network}
                onChange={e => setNetwork(e.target.value)}
              >
                {NETWORKS_BY_TOKEN[token].map(n => (
                  <option key={n.code} value={n.code}>{n.label}</option>
                ))}
              </select>
            </label>

            <label style={inputWrap}>
              <span style={labelText}>Amount (NGN)</span>
              <input
                style={inputBase}
                inputMode="decimal"
                placeholder="e.g. 5000"
                value={buyAmount}
                onChange={e => setBuyAmount(e.target.value)}
              />
            </label>

            <label style={inputWrap}>
              <span style={labelText}>Wallet Address ({toNetworkLabel(token, network)})</span>
              <input
                style={inputBase}
                placeholder="Paste your wallet address"
                value={walletAddress}
                onChange={e => setWalletAddress(e.target.value)}
              />
            </label>

            <div style={{ gridColumn: '1 / span 2', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button style={btnPrimary} disabled={initLoading}>
                {initLoading ? 'Starting…' : 'Pay & Continue'}
              </button>
            </div>
          </form>

          {redirectUrl && (
            <div style={{ ...card, marginTop: 12 }}>
              <div style={smallMuted}>
                If you weren’t redirected automatically, <a href={redirectUrl} target="_blank" rel="noopener noreferrer">click here to open the payment page</a>.
              </div>
              <div style={{ ...smallMuted, marginTop: 6 }}>
                You’ll be charged in NGN. On success, we’ll deliver your {token} to the provided wallet address on {toNetworkLabel(token, network)}.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <div style={smallMuted}>
            Ensure the wallet address is correct and controlled by you. Purchases are irreversible.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={btn} onClick={onClose}>Cancel</button>
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
