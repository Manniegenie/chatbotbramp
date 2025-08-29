// src/sell.tsx
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { tokenStore } from './lib/secureStore'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'

type InitiateSellRes = {
  success: boolean
  paymentId: string
  reference: string
  token?: string
  network?: string
  sellAmount?: number
  banks?: any                // backend may send string[] or object[]
  deposit: {
    address: string
    memo?: string | null
    token: string
    network: string
    amount: number
  }
  quote: {
    rate: number
    receiveCurrency: string
    receiveAmount: number
    expiresAt: string
  }
  message?: string
}

type PayoutRes = {
  success: boolean
  paymentId: string
  status: string
  token?: string
  network?: string
  sellAmount?: number
  quote?: {
    rate: number
    receiveCurrency: string
    receiveAmount: number
    expiresAt: string
  }
  payout: {
    bankName: string
    bankCode: string
    accountNumber: string
    accountName: string
    capturedAt: string
  }
  deposit?: {
    address: string
    memo?: string | null
  }
  message?: string
}

type SellModalProps = {
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

function toNetworkLabel(token: string, code: string) {
  const t = (token || '').toUpperCase() as TokenSym
  const list = NETWORKS_BY_TOKEN[t]
  const hit = list?.find(n => n.code === (code || '').toUpperCase())
  return hit?.label || code
}

function buildInitiateRecap(d: InitiateSellRes) {
  const t = (d.deposit?.token || d.token || '').toUpperCase()
  const netLabel = toNetworkLabel(t, d.deposit?.network || d.network || '')
  const payAmount = d.deposit?.amount ?? d.sellAmount
  const addr = d.deposit?.address
  const memo = d.deposit?.memo
  const recv = d.quote?.receiveAmount
  const rate = d.quote?.rate

  return [
    `Sell started ✅`,
    `Pay in: **${prettyAmount(Number(payAmount || 0))} ${t}** on **${netLabel}** (within 10 minutes).`,
    `Deposit address: ${addr}${memo ? ` (Memo/Tag: ${memo})` : ''}.`,
    `You’ll receive: **${prettyNgn(Number(recv || 0))}** at **${prettyAmount(Number(rate || 0))} NGN/${t}**.`,
    `⚠️ Please send the **exact amount** shown. Different amounts can delay or void processing.`,
  ].join('\n')
}

function buildPayoutRecap(init: InitiateSellRes | null, p: PayoutRes) {
  const t = (init?.deposit?.token || init?.token || '').toUpperCase()
  const netLabel = toNetworkLabel(t, init?.deposit?.network || init?.network || '')
  const payAmount = init?.deposit?.amount ?? init?.sellAmount
  const recv = init?.quote?.receiveAmount ?? p.quote?.receiveAmount
  const rate = init?.quote?.rate ?? p.quote?.rate

  return [
    `Payout details saved 🏦`,
    `Bank: ${p.payout.bankName} (${p.payout.bankCode})`,
    `Account: ${p.payout.accountName} — ${p.payout.accountNumber}`,
    '',
    `Recap: pay **${prettyAmount(Number(payAmount || 0))} ${t}** on **${netLabel}**.`,
    `You’ll receive: **${prettyNgn(Number(recv || 0))}** at **${prettyAmount(Number(rate || 0))} NGN/${t}**.`,
    `⚠️ Remember: pay the **exact amount** shown for smooth processing.`,
  ].join('\n')
}

/* =========================
   Polished Modal UI Styles (unchanged)
   ========================= */
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,.55)',
  display: 'grid',
  placeItems: 'center',
  padding: 16,
  zIndex: 1000,
}

const sheetStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 760,
  background: 'var(--card)',
  color: 'var(--txt)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  boxShadow: 'var(--shadow)',
  overflow: 'hidden',
  display: 'grid',
  gridTemplateRows: 'auto 1fr auto',
  animation: 'scaleIn 120ms ease-out',
}

const headerStyle: React.CSSProperties = {
  padding: '16px 18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: '1px solid var(--border)',
}

const titleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
}

const stepperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  color: 'var(--muted)',
}

const dot = (active: boolean): React.CSSProperties => ({
  width: 8,
  height: 8,
  borderRadius: 999,
  background: active ? 'var(--accent)' : 'var(--border)',
})

const bodyStyle: React.CSSProperties = {
  padding: 18,
  overflow: 'auto',
}

const footerStyle: React.CSSProperties = {
  padding: 16,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  borderTop: '1px solid var(--border)',
  background: 'linear-gradient(180deg, transparent, rgba(0,0,0,.05))',
}

const btn: React.CSSProperties = {
  appearance: 'none',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--txt)',
  padding: '10px 14px',
  borderRadius: 10,
  cursor: 'pointer',
}

const btnPrimary: React.CSSProperties = {
  ...btn,
  border: 'none',
  background: 'var(--accent)',
  color: 'white',
}

const btnDangerGhost: React.CSSProperties = {
  ...btn,
  borderColor: 'var(--border)',
  color: 'var(--muted)',
}

const gridForm: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
}

const inputWrap: React.CSSProperties = {
  display: 'grid',
  gap: 6,
}

const labelText: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--muted)',
}

const inputBase: React.CSSProperties = {
  background: '#0f1117',
  color: 'var(--txt)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '10px 12px',
  outline: 'none',
}

const singleColForm: React.CSSProperties = {
  display: 'grid',
  gap: 12,
}

const card: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 14,
  background: '#0e0f15',
  display: 'grid',
  gap: 10,
}

const kvGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
}

const kStyle: React.CSSProperties = { fontSize: 12, color: 'var(--muted)' }
const vStyle: React.CSSProperties = { fontWeight: 600 }

const mono: React.CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }

const smallMuted: React.CSSProperties = { fontSize: 12, color: 'var(--muted)' }

const row: React.CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap' }

const badge: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  padding: '6px 10px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: '#0d1210',
}

const badgeWarn: React.CSSProperties = {
  ...badge,
  background: 'rgba(255, 170, 0, .08)',
  borderColor: 'rgba(255, 170, 0, .25)',
}

const errorBanner: React.CSSProperties = {
  ...card,
  background: 'rgba(220, 50, 50, .1)',
  borderColor: 'rgba(220, 50, 50, .25)',
}

const successCard: React.CSSProperties = {
  ...card,
  background: 'rgba(0, 115, 55, .12)',
  borderColor: 'rgba(0, 115, 55, .35)',
}

/* =========================
   Helpers (NEW): normalize banks into a clean string[]
   ========================= */
function normalizeBankNames(raw: any): string[] {
  try {
    // If backend sent { banks: [...] } as strings
    if (Array.isArray(raw)) {
      const names = raw
        .map((b: any) => (typeof b === 'string' ? b : (b?.name ?? b?.bankName ?? b?.label ?? '')))
        .filter(Boolean)
        .map((s: string) => s.trim())
      return [...new Set(names)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    }
    // If it sent a JSON string (rare)
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return normalizeBankNames(parsed)
      } catch {}
      // Comma-separated fallback
      const names = raw.split(',').map(s => s.trim()).filter(Boolean)
      return [...new Set(names)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    }
  } catch {}
  return []
}

/* =========================
   Component
   ========================= */
export default function SellModal({ open, onClose, onChatEcho }: SellModalProps) {
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1 state
  const [token, setToken] = useState<TokenSym>('USDT')
  const [network, setNetwork] = useState(NETWORKS_BY_TOKEN['USDT'][0].code)
  const [amount, setAmount] = useState<string>('100')
  const [initLoading, setInitLoading] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [initData, setInitData] = useState<InitiateSellRes | null>(null)

  // Step 2 state
  const [bankName, setBankName] = useState('')      // from dropdown
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [payData, setPayData] = useState<PayoutRes | null>(null)

  // Effects
  useEffect(() => {
    if (!open) return
    setStep(1)
    setToken('USDT')
    setNetwork(NETWORKS_BY_TOKEN['USDT'][0].code)
    setAmount('100')
    setInitLoading(false)
    setInitError(null)
    setInitData(null)
    setBankName('')
    setAccountNumber('')
    setAccountName('')
    setPayLoading(false)
    setPayError(null)
    setPayData(null)
  }, [open])

  useEffect(() => {
    const list = NETWORKS_BY_TOKEN[token]
    if (!list.find(n => n.code === network)) setNetwork(list[0].code)
  }, [token])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Autofocus first input per step
  const firstInputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)
  useEffect(() => { firstInputRef.current?.focus() }, [step])

  const quote = initData?.quote
  const deposit = initData?.deposit
  const { text: countdown, expired } = useCountdown(quote?.expiresAt ?? null)

  async function submitInitiate(e: React.FormEvent) {
    e.preventDefault()
    setInitError(null)
    if (!amount || isNaN(+amount) || +amount <= 0) {
      setInitError('Enter a valid amount')
      return
    }
    setInitLoading(true)
    try {
      const res = await fetch(`${API_BASE}/sell/initiate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ token, network, sellAmount: +amount }),
      })
      const data: InitiateSellRes = await res.json()

      if (!res.ok || !data.success) throw new Error(data?.message || `HTTP ${res.status}`)

      // 🔑 Normalize banks RIGHT HERE and store as string[]
      const names = normalizeBankNames((data as any)?.banks)
      const dataFixed: InitiateSellRes = { ...(data as any), banks: names }
      console.log('sell.init → banks received:', (data as any)?.banks, '→ normalized:', names)

      setInitData(dataFixed)
      onChatEcho?.(buildInitiateRecap(dataFixed))
    } catch (err: any) {
      setInitError(err.message || 'Failed to initiate sell')
    } finally {
      setInitLoading(false)
    }
  }

  async function submitPayout(e: React.FormEvent) {
    e.preventDefault()
    setPayError(null)
    if (!bankName || !accountNumber || !accountName) {
      setPayError('Fill in all bank fields')
      return
    }
    if (!initData?.paymentId) {
      setPayError('Missing paymentId — restart the sell flow')
      return
    }
    setPayLoading(true)
    try {
      const res = await fetch(`${API_BASE}/sell/payout`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          paymentId: initData.paymentId,
          bankName,               // server maps name -> code using cache
          accountNumber,
          accountName,
        }),
      })
      const data: PayoutRes = await res.json()
      if (!res.ok || !data.success) throw new Error(data?.message || `HTTP ${res.status}`)
      setPayData(data)
      onChatEcho?.(buildPayoutRecap(initData, data))
    } catch (err: any) {
      setPayError(err.message || 'Failed to save payout details')
    } finally {
      setPayLoading(false)
    }
  }

  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  function copyToClipboard(text: string, key: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1200)
    }).catch(() => {})
  }

  if (!open) return null

  const canContinue = !!initData && !expired
  const headerTitle = step === 1 ? 'Start a Sell' : 'Payout Details'
  const showFinalSummary = !!payData

  // Use the already-normalized banks from state
  const bankNames: string[] = (initData?.banks as string[]) ?? []

  return createPortal(
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="sell-title" onClick={onClose}>
      <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={titleRowStyle}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#0d1512', display: 'grid', placeItems: 'center', border: '1px solid var(--border)' }}>
              💱
            </div>
            <div>
              <div id="sell-title" style={{ fontWeight: 700 }}>{headerTitle}</div>
              <div style={stepperStyle}>
                <span style={dot(step === 1)}></span> Step 1 — Deposit
                <span style={{ opacity: .4, padding: '0 6px' }}>•</span>
                <span style={dot(step === 2)}></span> Step 2 — Payout
              </div>
            </div>
          </div>
          <button type="button" aria-label="Close" style={btnDangerGhost} onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div style={bodyStyle}>
          {/* STEP 1 */}
          {step === 1 && (
            <div style={{ display: 'grid', gap: 14 }}>
              <p style={{ margin: 0, color: 'var(--muted)' }}>
                Choose token, network, and amount. You’ll get a single deposit address and a 10-minute window.
              </p>

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

                <label style={{ ...inputWrap, gridColumn: '1 / span 2' }}>
                  <span style={labelText}>Amount ({token})</span>
                  <input
                    style={inputBase}
                    inputMode="decimal"
                    placeholder="e.g. 100"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                  />
                </label>

                <div style={{ gridColumn: '1 / span 2', display: 'flex', justifyContent: 'flex-end' }}>
                  <button style={btnPrimary} disabled={initLoading}>
                    {initLoading ? 'Starting…' : 'Get Deposit Details'}
                  </button>
                </div>
              </form>

              {initData && (
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Deposit Details</h3>
                    <div style={badge}>
                      ⏱ {expired ? 'Expired' : countdown} <span style={{ opacity: .6 }}>of 10:00</span>
                    </div>
                  </div>

                  <div style={kvGrid}>
                    <div>
                      <div style={kStyle}>Send to Address</div>
                      <div style={{ ...vStyle, ...mono, wordBreak: 'break-all' }}>{deposit?.address}</div>
                      <div style={row}>
                        <button
                          style={btn}
                          onClick={() => deposit?.address && copyToClipboard(deposit.address, 'addr')}
                        >
                          {copiedKey === 'addr' ? 'Copied ✓' : 'Copy Address'}
                        </button>
                      </div>
                    </div>

                    {!!deposit?.memo && (
                      <div>
                        <div style={kStyle}>Memo / Tag</div>
                        <div style={{ ...vStyle, ...mono, wordBreak: 'break-all' }}>{deposit.memo}</div>
                        <div style={row}>
                          <button
                            style={btn}
                            onClick={() => copyToClipboard(deposit!.memo!, 'memo')}
                          >
                            {copiedKey === 'memo' ? 'Copied ✓' : 'Copy Memo'}
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      <div style={kStyle}>You Receive</div>
                      <div style={vStyle}>
                        {prettyNgn(quote?.receiveAmount || 0)}&nbsp;
                        <span style={{ color: 'var(--muted)', fontWeight: 500 }}>
                          at {prettyAmount(quote?.rate || 0)} NGN/{deposit?.token || token}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div style={kStyle}>Network</div>
                      <div style={vStyle}>{toNetworkLabel(deposit?.token || token, deposit?.network || network)}</div>
                    </div>
                  </div>

                  <div style={{ ...smallMuted, ...badgeWarn }}>
                    ⚠️ Only send {deposit?.token || token} on the selected network. Wrong-network deposits can be lost.
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      style={btn}
                      onClick={() => setInitData(null)}
                      title="Restart the sell setup"
                    >
                      Restart
                    </button>
                    <button style={btnPrimary} onClick={() => setStep(2)} disabled={!canContinue}>
                      Continue to Payout
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div style={{ display: 'grid', gap: 14 }}>
              {!initData && (
                <div role="alert" style={errorBanner}>
                  Missing sell reference — please restart.
                </div>
              )}

              {initData && !showFinalSummary && (
                <>
                  <div style={card}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Summary</h3>
                    <div style={kvGrid}>
                      <div>
                        <div style={kStyle}>Payment ID</div>
                        <div style={{ ...vStyle, ...mono }}>{initData.paymentId}</div>
                      </div>
                      <div>
                        <div style={kStyle}>Reference</div>
                        <div style={{ ...vStyle, ...mono }}>{initData.reference}</div>
                      </div>
                      <div>
                        <div style={kStyle}>You Receive</div>
                        <div style={vStyle}>
                          {prettyNgn(initData.quote.receiveAmount)} ({initData.quote.receiveCurrency})
                        </div>
                      </div>
                      <div>
                        <div style={kStyle}>Rate</div>
                        <div style={vStyle}>{prettyAmount(initData.quote.rate)} NGN/{initData.deposit.token}</div>
                      </div>
                    </div>
                  </div>

                  {!!payError && (
                    <div role="alert" style={errorBanner}>
                      <strong style={{ color: '#ffaaaa' }}>Error:</strong> {payError}
                    </div>
                  )}

                  {/* Bank Name dropdown + account fields */}
                  <form onSubmit={submitPayout} style={gridForm}>
                    <label style={inputWrap}>
                      <span style={labelText}>Bank Name</span>
                      <select
                        ref={firstInputRef as any}
                        style={inputBase}
                        value={bankName}
                        onChange={e => setBankName(e.target.value)}
                        disabled={(bankNames ?? []).length === 0}
                      >
                        <option value="">
                          {(bankNames ?? []).length ? 'Select your bank' : 'No banks available'}
                        </option>
                        {(bankNames ?? []).map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </label>

                    <label style={inputWrap}>
                      <span style={labelText}>Account Number</span>
                      <input
                        style={inputBase}
                        value={accountNumber}
                        onChange={e => setAccountNumber(e.target.value)}
                        placeholder="e.g. 0123456789"
                      />
                    </label>

                    <label style={{ ...inputWrap, gridColumn: '1 / span 2' }}>
                      <span style={labelText}>Account Name</span>
                      <input
                        style={inputBase}
                        value={accountName}
                        onChange={e => setAccountName(e.target.value)}
                        placeholder="e.g. Chibuike Nwogbo Emmanuel"
                      />
                    </label>

                    <div style={{ gridColumn: '1 / span 2', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                      <button style={btnPrimary} disabled={payLoading}>
                        {payLoading ? 'Saving…' : 'Save Payout Details'}
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* FINAL SUMMARY (after payout saved) */}
              {initData && showFinalSummary && payData && (
                <div style={successCard}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Transaction Summary</h3>
                    <div style={badge}>
                      ⏱ {expired ? 'Expired' : countdown} <span style={{ opacity: .6 }}>of 10:00</span>
                    </div>
                  </div>

                  <div style={kvGrid}>
                    <div>
                      <div style={kStyle}>Status</div>
                      <div style={vStyle}>{payData.status}</div>
                    </div>
                    <div>
                      <div style={kStyle}>Payment ID</div>
                      <div style={{ ...vStyle, ...mono }}>{payData.paymentId}</div>
                    </div>
                    <div>
                      <div style={kStyle}>Reference</div>
                      <div style={{ ...vStyle, ...mono }}>{initData.reference}</div>
                    </div>
                    <div>
                      <div style={kStyle}>You Receive</div>
                      <div style={vStyle}>
                        {prettyNgn((initData.quote.receiveAmount) || 0)} ({initData.quote.receiveCurrency})
                      </div>
                    </div>
                    <div>
                      <div style={kStyle}>Rate</div>
                      <div style={vStyle}>{prettyAmount(initData.quote.rate)} NGN/{initData.deposit.token}</div>
                    </div>
                    <div>
                      <div style={kStyle}>Bank</div>
                      <div style={vStyle}>{payData.payout.bankName} ({payData.payout.bankCode})</div>
                    </div>
                    <div>
                      <div style={kStyle}>Account</div>
                      <div style={vStyle}>{payData.payout.accountName} — {payData.payout.accountNumber}</div>
                    </div>
                    <div>
                      <div style={kStyle}>Deposit Address</div>
                      <div style={{ ...vStyle, ...mono, wordBreak: 'break-all' }}>{initData.deposit.address}</div>
                      <div style={row}>
                        <button
                          style={btn}
                          onClick={() => copyToClipboard(initData.deposit.address, 'addr2')}
                        >
                          {copiedKey === 'addr2' ? 'Copied ✓' : 'Copy Address'}
                        </button>
                      </div>
                    </div>
                    {!!initData.deposit.memo && (
                      <div>
                        <div style={kStyle}>Memo / Tag</div>
                        <div style={{ ...vStyle, ...mono, wordBreak: 'break-all' }}>{initData.deposit.memo}</div>
                        <div style={row}>
                          <button
                            style={btn}
                            onClick={() => copyToClipboard(initData.deposit.memo!, 'memo2')}
                          >
                            {copiedKey === 'memo2' ? 'Copied ✓' : 'Copy Memo'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ ...smallMuted, ...badgeWarn }}>
                    ⚠️ Send exactly {prettyAmount(initData.deposit.amount)} {initData.deposit.token} on {toNetworkLabel(initData.deposit.token, initData.deposit.network)} before the timer runs out.
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button style={btnPrimary} onClick={onClose}>Done</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <div style={smallMuted}>
            {step === 1
              ? 'Send the exact amount within the window for smooth processing.'
              : (showFinalSummary
                  ? 'You can close this modal anytime after copying the details.'
                  : 'Ensure your bank details match your account name.')}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {step === 2 ? (
              !showFinalSummary ? (
                <button style={btn} onClick={() => setStep(1)}>← Back</button>
              ) : (
                <button style={btn} onClick={onClose}>Close</button>
              )
            ) : (
              <button style={btn} onClick={onClose}>Cancel</button>
            )}
            {step === 1 && (
              <button style={{ ...btnPrimary, opacity: initData && !expired ? 1 : .6 }} onClick={() => setStep(2)} disabled={!canContinue}>
                Continue
              </button>
            )}
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
