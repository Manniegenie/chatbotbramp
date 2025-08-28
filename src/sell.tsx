// src/sell.tsx
import React, { useEffect, useState } from 'react'
import { tokenStore } from './lib/secureStore'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'

type InitiateSellRes = {
  success: boolean
  paymentId: string
  reference: string
  token?: string           // echo from backend (added in your service)
  network?: string         // echo from backend (added in your service)
  sellAmount?: number      // echo from backend (added in your service)
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
  /** 👇 Provide this from App.tsx to echo friendly recaps into the chat */
  onChatEcho?: (text: string) => void
}

const TOKENS = ['USDT','USDC','BTC','ETH','SOL','BNB','MATIC','AVAX'] as const
type TokenSym = typeof TOKENS[number]

const NETWORKS_BY_TOKEN: Record<TokenSym, { code: string; label: string }[]> = {
  BTC:   [{ code: 'BTC', label: 'Bitcoin' }],
  ETH:   [{ code: 'ETH', label: 'Ethereum' }],
  SOL:   [{ code: 'SOL', label: 'Solana' }],
  BNB:   [{ code: 'BSC', label: 'BNB Smart Chain' }],
  MATIC: [{ code: 'ETH', label: 'Ethereum (ERC-20)' }], // change if using Polygon mainnet
  AVAX:  [{ code: 'BSC', label: 'BNB Smart Chain' }],  // change to AVAXC if using C-Chain
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

// 👉 helper to map network code -> nice label (best-effort with token context)
function toNetworkLabel(token: string, code: string) {
  const t = (token || '').toUpperCase() as TokenSym
  const list = NETWORKS_BY_TOKEN[t]
  const hit = list?.find(n => n.code === (code || '').toUpperCase())
  return hit?.label || code
}

// 👉 builders for friendly chat recaps
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

export default function SellModal({ open, onClose, onChatEcho }: SellModalProps) {
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1
  const [token, setToken] = useState<TokenSym>('USDT')
  const [network, setNetwork] = useState(NETWORKS_BY_TOKEN['USDT'][0].code)
  const [amount, setAmount] = useState<string>('100')
  const [initLoading, setInitLoading] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [initData, setInitData] = useState<InitiateSellRes | null>(null)

  // Step 2
  const [bankName, setBankName] = useState('')
  const [bankCode, setBankCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [payData, setPayData] = useState<PayoutRes | null>(null)

  // reset on open
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
    setBankCode('')
    setAccountNumber('')
    setAccountName('')
    setPayLoading(false)
    setPayError(null)
    setPayData(null)
  }, [open])

  // keep network valid if token changes
  useEffect(() => {
    const list = NETWORKS_BY_TOKEN[token]
    if (!list.find(n => n.code === network)) {
      setNetwork(list[0].code)
    }
  }, [token])

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
      setInitData(data)

      // 👇 Echo a friendly recap into chat
      onChatEcho?.(buildInitiateRecap(data))
    } catch (err: any) {
      setInitError(err.message || 'Failed to initiate sell')
    } finally {
      setInitLoading(false)
    }
  }

  async function submitPayout(e: React.FormEvent) {
    e.preventDefault()
    setPayError(null)
    if (!bankName || !bankCode || !accountNumber || !accountName) {
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
          bankName,
          bankCode,
          accountNumber,
          accountName,
        }),
      })
      const data: PayoutRes = await res.json()
      if (!res.ok || !data.success) throw new Error(data?.message || `HTTP ${res.status}`)
      setPayData(data)

      // 👇 Echo a payout recap into chat
      onChatEcho?.(buildPayoutRecap(initData, data))
    } catch (err: any) {
      setPayError(err.message || 'Failed to save payout details')
    } finally {
      setPayLoading(false)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard?.writeText(text).catch(() => {})
  }

  if (!open) return null

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <button className="modal-close" onClick={onClose}>✕</button>

        {step === 1 && (
          <div className="modal-section">
            <h2>Start a Sell</h2>
            <p className="muted">Choose token, network, and amount. You’ll get a single deposit address and a 10-minute window.</p>

            <form onSubmit={submitInitiate} className="form-grid">
              <label>
                <span>Token</span>
                <select value={token} onChange={e => setToken(e.target.value as TokenSym)}>
                  {TOKENS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>

              <label>
                <span>Network</span>
                <select value={network} onChange={e => setNetwork(e.target.value)}>
                  {NETWORKS_BY_TOKEN[token].map(n => (
                    <option key={n.code} value={n.code}>{n.label}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Amount ({token})</span>
                <input
                  inputMode="decimal"
                  placeholder="e.g. 100"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
              </label>

              {initError && <div className="error">{initError}</div>}

              <button className="btn primary" disabled={initLoading}>
                {initLoading ? 'Starting…' : 'Get Deposit Details'}
              </button>
            </form>

            {initData && (
              <>
                <div className="panel">
                  <h3>Deposit Details</h3>
                  <div className="kv">
                    <div>
                      <div className="k">Send to Address</div>
                      <div className="v mono">{deposit?.address}</div>
                      <button className="btn" onClick={() => deposit?.address && copyToClipboard(deposit.address)}>Copy Address</button>
                    </div>

                    {!!deposit?.memo && (
                      <div>
                        <div className="k">Memo / Tag</div>
                        <div className="v mono">{deposit?.memo}</div>
                        <button className="btn" onClick={() => copyToClipboard(deposit!.memo!)}>Copy Memo</button>
                      </div>
                    )}

                    <div>
                      <div className="k">Window</div>
                      <div className="v">{expired ? 'Expired' : countdown} (10:00 max)</div>
                    </div>

                    <div>
                      <div className="k">You Receive</div>
                      <div className="v">
                        {prettyNgn(quote?.receiveAmount || 0)} at {prettyAmount(quote?.rate || 0)} NGN/{deposit?.token || token}
                      </div>
                    </div>
                  </div>
                  <div className="small muted">
                    Only send {deposit?.token || token} on the selected network ({toNetworkLabel(deposit?.token || token, deposit?.network || network)}). Wrong-network deposits can be lost.
                  </div>
                </div>

                <div className="row">
                  <button className="btn ghost" onClick={() => setInitData(null)}>Restart</button>
                  <button className="btn primary" onClick={() => setStep(2)} disabled={expired}>
                    Continue to Payout
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="modal-section">
            <h2>Payout Details</h2>

            {!initData && <div className="error">Missing sell reference — please restart.</div>}

            {initData && (
              <>
                <div className="panel">
                  <div className="kv">
                    <div>
                      <div className="k">Payment ID</div>
                      <div className="v mono">{initData.paymentId}</div>
                    </div>
                    <div>
                      <div className="k">Reference</div>
                      <div className="v mono">{initData.reference}</div>
                    </div>
                    <div>
                      <div className="k">You Receive</div>
                      <div className="v">{prettyNgn(initData.quote.receiveAmount)} ({initData.quote.receiveCurrency})</div>
                    </div>
                  </div>
                </div>

                <form onSubmit={submitPayout} className="form-grid">
                  <label>
                    <span>Bank Name</span>
                    <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. GTBank" />
                  </label>
                  <label>
                    <span>Bank Code</span>
                    <input value={bankCode} onChange={e => setBankCode(e.target.value)} placeholder="e.g. 058" />
                  </label>
                  <label>
                    <span>Account Number</span>
                    <input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="e.g. 0123456789" />
                  </label>
                  <label>
                    <span>Account Name</span>
                    <input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="e.g. Chibuike Nwogbo Emmanuel" />
                  </label>

                  {payError && <div className="error">{payError}</div>}

                  <button className="btn primary" disabled={payLoading}>
                    {payLoading ? 'Saving…' : 'Save Payout Details'}
                  </button>
                </form>

                {payData && (
                  <div className="panel success">
                    <h3>Saved ✅</h3>
                    <div className="kv">
                      <div><div className="k">Status</div><div className="v">{payData.status}</div></div>
                      <div><div className="k">Account</div><div className="v">{payData.payout.accountName} — {payData.payout.accountNumber}</div></div>
                      <div><div className="k">Bank</div><div className="v">{payData.payout.bankName} ({payData.payout.bankCode})</div></div>
                    </div>
                    <div className="row">
                      <button className="btn" onClick={onClose}>Done</button>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="row">
              <button className="btn ghost" onClick={() => setStep(1)}>← Back</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
