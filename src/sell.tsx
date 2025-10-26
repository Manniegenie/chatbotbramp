// src/sell.tsx
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { tokenStore } from './lib/secureStore'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'

type BankOption = { name: string; code: string }

type InitiateSellRes = {
  success: boolean
  paymentId: string
  reference: string
  token?: string
  network?: string
  sellAmount?: number
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
  onStartInteraction?: () => void
}

const TOKENS = ['USDT', 'USDC', 'BTC', 'ETH', 'SOL', 'BNB'] as const
type TokenSym = typeof TOKENS[number]

const NETWORKS_BY_TOKEN: Record<TokenSym, { code: string; label: string }[]> = {
  BTC: [{ code: 'BTC', label: 'Bitcoin' }],
  ETH: [{ code: 'ETH', label: 'Ethereum' }],
  SOL: [{ code: 'SOL', label: 'Solana' }],
  BNB: [{ code: 'BSC', label: 'BNB Smart Chain' }],
  USDT: [
    { code: 'ETH', label: 'Ethereum (ERC-20)' },
    { code: 'TRX', label: 'Tron (TRC-20)' },
    { code: 'BSC', label: 'BNB Smart Chain (BEP-20)' },
  ],
  USDC: [
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

function buildPayoutRecap(init: InitiateSellRes | null, p: PayoutRes) {
  const t = (init?.deposit?.token || init?.token || '').toUpperCase()
  const netLabel = toNetworkLabel(t, init?.deposit?.network || init?.network || '')
  const payAmount = init?.deposit?.amount ?? init?.sellAmount
  const recv = init?.quote?.receiveAmount ?? p.quote?.receiveAmount
  const rate = init?.quote?.rate ?? p.quote?.rate

  return [
    `Payout details saved 🏦`,
    `Bank: ${p.payout.bankName}`,
    `Account: ${p.payout.accountName} — ${p.payout.accountNumber}`,
    '',
    `Recap: pay **${prettyAmount(Number(payAmount || 0))} ${t}** on **${netLabel}**.`,
    `You'll receive: **${prettyNgn(Number(recv || 0))}** at **${prettyAmount(Number(rate || 0))} NGN/${t}**.`,
    `⚠️ Remember: pay the **exact amount** shown for smooth processing.`,
  ].join('\n')
}

// Simple QR Code generator function
function generateQRCode(text: string, size: number = 128): string {
  // Using QR Server API for simplicity - in production you might want to use a client-side library
  const baseUrl = 'https://api.qrserver.com/v1/create-qr-code/'
  const params = new URLSearchParams({
    size: `${size}x${size}`,
    data: text,
    format: 'svg',
    bgcolor: '0f1117',
    color: 'ffffff',
    margin: '10'
  })
  return `${baseUrl}?${params.toString()}`
}

// QR Code component
function QRCode({ data, size = 120 }: { data: string; size?: number }) {
  const qrUrl = generateQRCode(data, size)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      background: '#0a0b0f',
      border: '1px solid var(--border)',
      borderRadius: 12,
      minWidth: 'fit-content'
    }}>
      <img
        src={qrUrl}
        alt="QR Code for deposit address"
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          background: 'white',
          padding: 4
        }}
      />
      <div style={{
        fontSize: 10,
        color: 'var(--muted)',
        textAlign: 'center',
        maxWidth: size
      }}>
        Scan to copy address
      </div>
    </div>
  )
}

/* ===== Minimal inline modal styles ===== */
const overlayStyle: React.CSSProperties = { 
  position: 'fixed', 
  top: 0, 
  left: 0, 
  width: '100vw', 
  height: '100vh', 
  background: 'linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(/src/assets/wallpaper1.jpg) center/cover no-repeat', 
  zIndex: 1000,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '20px 16px',
  overflow: 'hidden',
  touchAction: 'none'
}
const sheetStyle: React.CSSProperties = { 
  maxWidth: '600px', 
  width: '100%',
  maxHeight: '90vh',
  marginTop: '2vh',
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  padding: '32px',
  boxShadow: 'var(--shadow)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column'
}
const headerStyle: React.CSSProperties = { marginBottom: '16px', flexShrink: 0 }
const titleRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6 }
const stepperStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)' }
const dot = (active: boolean): React.CSSProperties => ({ width: 8, height: 8, borderRadius: 999, background: active ? 'var(--accent)' : 'var(--border)' })
const bodyStyle: React.CSSProperties = { flex: 1, overflow: 'auto', minHeight: 0 }
const footerStyle: React.CSSProperties = { padding: 10, display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--border)', background: 'linear-gradient(180deg, transparent, rgba(0,0,0,.05))' }
const btn: React.CSSProperties = { appearance: 'none', border: '1px solid var(--border)', background: 'transparent', color: 'var(--txt)', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }
const btnPrimary: React.CSSProperties = { ...btn, border: 'none', background: 'var(--accent)', color: 'white' }
const btnDangerGhost: React.CSSProperties = { ...btn, borderColor: 'var(--border)', color: 'var(--muted)' }
const gridForm: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }
const inputWrap: React.CSSProperties = { display: 'grid', gap: 4 }
const labelText: React.CSSProperties = { fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }
const inputBase: React.CSSProperties = { background: '#0f1117', color: 'var(--txt)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', outline: 'none', fontSize: '14px' }
const card: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: 10, background: '#0e0f15', display: 'grid', gap: 8 }
const kvGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }
const kStyle: React.CSSProperties = { fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }
const vStyle: React.CSSProperties = { fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }
const mono: React.CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }
const smallMuted: React.CSSProperties = { fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }
const row: React.CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap' }
const badge: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '4px 8px', borderRadius: 999, border: '1px solid var(--border)', background: '#0d1210' }
const badgeWarn: React.CSSProperties = { ...badge, background: 'rgba(255, 170, 0, .08)', borderColor: 'rgba(255, 170, 0, .25)' }
const errorBanner: React.CSSProperties = { ...card, background: 'rgba(220, 50, 50, .1)', borderColor: 'rgba(220, 50, 50, .25)' }
const successCard: React.CSSProperties = { ...card, background: 'rgba(0, 115, 55, .12)', borderColor: 'rgba(0, 115, 55, .35)' }

export default function SellModal({ open, onClose, onChatEcho, onStartInteraction }: SellModalProps) {
  // Steps: 1 = Start Sell, 2 = Payout. Final summary is a sub-state of step 2.
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1 (Start Sell)
  const [token, setToken] = useState<TokenSym>('USDT')
  const [network, setNetwork] = useState(NETWORKS_BY_TOKEN['USDT'][0].code)
  const [amount, setAmount] = useState<string>('100')
  const [currency, setCurrency] = useState<'TOKEN' | 'NGN'>('TOKEN')
  const [nairaAmount, setNairaAmount] = useState<string>('')
  const [initLoading, setInitLoading] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [initData, setInitData] = useState<InitiateSellRes | null>(null)

  // Step 2 (Payout + Summary)
  const [bankName, setBankName] = useState('')
  const [bankCode, setBankCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNameLoading, setAccountNameLoading] = useState(false)
  const [accountNameError, setAccountNameError] = useState<string | null>(null)
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [payData, setPayData] = useState<PayoutRes | null>(null)

  // Countdown should start only AFTER payout is saved (local 10:00 window)
  const [summaryExpiresAt, setSummaryExpiresAt] = useState<string | null>(null)
  const { text: countdown, expired } = useCountdown(summaryExpiresAt)

  // Banks
  const [banksLoading, setBanksLoading] = useState(false)
  const [banksError, setBanksError] = useState<string | null>(null)
  const [bankOptions, setBankOptions] = useState<BankOption[]>([])
  const banksFetchedRef = useRef(false)



  // Reset on open
  useEffect(() => {
    if (!open) return
    setStep(1)
    setToken('USDT')
    setNetwork(NETWORKS_BY_TOKEN['USDT'][0].code)
    setAmount('100')
    setCurrency('TOKEN')
    setNairaAmount('')
    setInitLoading(false)
    setInitError(null)
    setInitData(null)
    setBankName('')
    setBankCode('')
    setAccountNumber('')
    setAccountName('')
    setAccountNameLoading(false)
    setAccountNameError(null)
    setPayLoading(false)
    setPayError(null)
    setPayData(null)
    setBanksLoading(false)
    setBanksError(null)
    setBankOptions([])
    setSummaryExpiresAt(null)
    banksFetchedRef.current = false
  }, [open])

  // Keep network valid
  useEffect(() => {
    const list = NETWORKS_BY_TOKEN[token]
    if (!list.find(n => n.code === network)) setNetwork(list[0].code)
  }, [token])

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

  // Fetch banks once when entering Step 2
  useEffect(() => {
    if (!open || step !== 2 || banksFetchedRef.current) return
    banksFetchedRef.current = true
      ; (async () => {
        setBanksLoading(true)
        setBanksError(null)
        try {
          const res = await fetch(`${API_BASE}/fetchnaira/naira-accounts`, { method: 'GET', cache: 'no-store' })
          const json = await res.json()
          if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)

          const list: BankOption[] = Array.isArray(json?.banks) ? json.banks : []
          const opts: BankOption[] = (list as BankOption[])
            .map((b: BankOption) => ({ name: String(b.name || '').trim(), code: String(b.code || '').trim() }))
            .filter((b: BankOption) => b.name.length > 0 && b.code.length > 0)
            .sort((a: BankOption, b: BankOption) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

          setBankOptions(opts)
          if (opts.length) {
            setBankCode(opts[0].code)
            setBankName(opts[0].name)
          } else {
            setBankCode('')
            setBankName('')
          }
        } catch (e: any) {
          setBanksError(e?.message || 'Failed to load banks')
          setBankOptions([])
          setBankCode('')
          setBankName('')
        } finally {
          setBanksLoading(false)
        }
      })()
  }, [open, step])

  // Resolve account name (debounced)
  useEffect(() => {
    if (!open || step !== 2 || !bankCode || !accountNumber) return
    if (accountNumber.length < 10) {
      setAccountName('')
      setAccountNameError(null)
      return
    }

    const timeoutId = setTimeout(async () => {
      setAccountNameLoading(true)
      setAccountNameError(null)
      setAccountName('')
      try {
        const res = await fetch(
          `${API_BASE}/accountname/resolve?sortCode=${encodeURIComponent(bankCode)}&accountNumber=${encodeURIComponent(accountNumber)}`,
          { method: 'GET', headers: getHeaders() }
        )
        const data = await res.json()
        if (!res.ok || !data.success) {
          throw new Error(data?.message || `HTTP ${res.status}`)
        }
        if (data.data?.accountName) {
          setAccountName(data.data.accountName)
          setAccountNameError(null)
        } else {
          throw new Error('Account name not found')
        }
      } catch (err: any) {
        setAccountName('')
        setAccountNameError(err?.message || 'Failed to resolve account name')
      } finally {
        setAccountNameLoading(false)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [open, step, bankCode, accountNumber])

  async function submitInitiate(e: React.FormEvent) {
    e.preventDefault()
    setInitError(null)

    // Validate input based on currency
    if (currency === 'TOKEN') {
      if (!amount || isNaN(+amount) || +amount <= 0) {
        setInitError('Enter a valid token amount')
        return
      }
    } else {
      // Remove commas for validation
      const cleanNairaAmount = nairaAmount.replace(/,/g, '');
      if (!cleanNairaAmount || isNaN(+cleanNairaAmount) || +cleanNairaAmount <= 0) {
        setInitError('Enter a valid Naira amount')
        return
      }
    }

    setInitLoading(true)
    try {
      let requestBody: any = { token, network, currency }

      if (currency === 'TOKEN') {
        requestBody.sellAmount = +amount
      } else {
        // For NGN, send clean NGN amount (remove commas)
        const cleanNairaAmount = nairaAmount.replace(/,/g, '');
        requestBody.sellAmount = +cleanNairaAmount
      }

      const res = await fetch(`${API_BASE}/sell/initiate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(requestBody),
      })
      const data: InitiateSellRes = await res.json()
      if (!res.ok || !data.success) throw new Error(data?.message || `HTTP ${res.status}`)
      setInitData(data)
      // 🚀 Go straight to payout (no deposit-details screen)
      setStep(2)
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
      onChatEcho?.(buildPayoutRecap(initData, data))
      // ⏱ Start a fresh local 10:00 window AFTER payout is captured
      setSummaryExpiresAt(new Date(Date.now() + 10 * 60 * 1000).toISOString())
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
    }).catch(() => { })
  }

  if (!open) return null

  const headerTitle =
    step === 1 ? 'Start a Payment'
      : (!payData ? 'Payout Details' : 'Transaction Summary')

  const showFinalSummary = !!payData

  // Build QR data - include memo if present for compatible wallets
  const qrData = initData ?
    (initData.deposit.memo ?
      `${initData.deposit.address}?memo=${initData.deposit.memo}` :
      initData.deposit.address
    ) : ''

  return createPortal(
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="sell-title" onClick={onClose}>
      <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        {/* Loading Overlay */}
        {(initLoading || payLoading || accountNameLoading || banksLoading) && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            borderRadius: '12px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid rgba(255, 255, 255, 0.3)',
              borderTop: '3px solid #007bff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '16px'
            }}></div>
            <div style={{ color: 'white', fontSize: '16px', fontWeight: 500 }}>
              {initLoading && 'Starting sell...'}
              {payLoading && 'Saving payout...'}
              {accountNameLoading && 'Validating account...'}
              {banksLoading && 'Loading banks...'}
            </div>
          </div>
        )}
        {/* Header */}
        <div style={{ ...headerStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <h2 id="sell-title" style={{ margin: 0, fontSize: '1.3rem', fontWeight: 600, color: 'var(--txt)' }}>
              {step === 1 ? 'Start a Payment' : 'Payout Details'}
            </h2>
            <div style={stepperStyle}>
              <span style={dot(step >= 1)} />
              <span style={dot(step >= 2)} />
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={bodyStyle}>
          {/* STEP 1 — Start a Payment (no deposit-details screen; goes straight to payout on success) */}
          {step === 1 && (
            <div style={{ display: 'grid', gap: 14 }}>


              {!!initError && (
                <div role="alert" style={errorBanner}>
                  <strong style={{ color: '#ffaaaa' }}>Error:</strong> {initError}
                </div>
              )}

              <form onSubmit={submitInitiate} style={{ display: 'grid', gap: 12 }}>
                {/* Token and Network on same line */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={inputWrap}>
                    <span style={labelText}>Token <span style={{ fontSize: '10px', opacity: 0.7 }}>▼</span></span>
                    <select
                      ref={firstInputRef as any}
                      style={{ ...inputBase, cursor: 'pointer' }}
                      value={token}
                      onChange={e => {
                        setToken(e.target.value as TokenSym)
                        onStartInteraction?.()
                      }}
                    >
                      {TOKENS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>

                  <label style={inputWrap}>
                    <span style={labelText}>Network <span style={{ fontSize: '10px', opacity: 0.7 }}>▼</span></span>
                    <select
                      style={{ ...inputBase, cursor: 'pointer' }}
                      value={network}
                      onChange={e => {
                        setNetwork(e.target.value)
                        onStartInteraction?.()
                      }}
                    >
                      {NETWORKS_BY_TOKEN[token].map(n => (
                        <option key={n.code} value={n.code}>{n.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Currency and Amount on same line */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={inputWrap}>
                    <span style={labelText}>Currency <span style={{ fontSize: '10px', opacity: 0.7 }}>▼</span></span>
                    <select
                      style={{ ...inputBase, cursor: 'pointer' }}
                      value={currency}
                      onChange={e => setCurrency(e.target.value as 'TOKEN' | 'NGN')}
                    >
                      <option value="TOKEN">{token}</option>
                      <option value="NGN">NGN</option>
                    </select>
                  </label>

                  {currency === 'TOKEN' ? (
                    <label style={inputWrap}>
                      <span style={labelText}>Amount ({token})</span>
                      <input
                        style={inputBase}
                        inputMode="decimal"
                        placeholder="e.g. 100"
                        value={amount}
                        onChange={e => {
                          setAmount(e.target.value)
                          onStartInteraction?.()
                        }}
                      />
                    </label>
                  ) : (
                    <label style={inputWrap}>
                      <span style={labelText}>Amount (NGN)</span>
                      <input
                        style={inputBase}
                        inputMode="decimal"
                        placeholder="e.g. 50,000"
                        value={nairaAmount}
                        onChange={e => {
                          // Remove commas and non-numeric characters except decimal point
                          const cleanValue = e.target.value.replace(/[^\d.]/g, '');
                          setNairaAmount(cleanValue);
                        }}
                        onBlur={e => {
                          // Format with commas when user finishes typing
                          const num = parseFloat(e.target.value);
                          if (!isNaN(num) && num > 0) {
                            setNairaAmount(num.toLocaleString('en-US'));
                          }
                        }}
                      />
                    </label>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button style={btnPrimary} disabled={initLoading}>
                    {initLoading ? 'Starting…' : 'Start & Continue to Payout'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 2 — Payout (then Summary with countdown) */}
          {step === 2 && (
            <div style={{ display: 'grid', gap: 14 }}>
              {!initData && (
                <div role="alert" style={errorBanner}>
                  Missing sell reference — please restart.
                </div>
              )}

              {initData && !showFinalSummary && (
                <>

                  {!!payError && (
                    <div role="alert" style={errorBanner}>
                      <strong style={{ color: '#ffaaaa' }}>Error:</strong> {payError}
                    </div>
                  )}

                  <form onSubmit={submitPayout} style={{ display: 'grid', gap: 12 }}>

                    <label style={inputWrap}>
                      <span style={labelText}>Bank <span style={{ fontSize: '10px', opacity: 0.7 }}>▼</span></span>
                      <select
                        ref={firstInputRef as any}
                        style={{ ...inputBase, cursor: 'pointer' }}
                        value={bankCode}
                        disabled={banksLoading || bankOptions.length === 0}
                        onChange={e => {
                          const code = e.target.value
                          const hit = bankOptions.find((b: BankOption) => b.code === code)
                          if (hit) {
                            setBankCode(hit.code)
                            setBankName(hit.name)
                          }
                        }}
                      >
                        {bankOptions.length === 0 ? (
                          <option value="">{banksLoading ? 'Loading…' : (banksError || 'No banks')}</option>
                        ) : (
                          bankOptions.map((b: BankOption) => (
                            <option key={b.code} value={b.code}>{b.name}</option>
                          ))
                        )}
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

                    <label style={inputWrap}>
                      <span style={labelText}>Account Name</span>
                      <div style={{ ...inputBase, background: '#1a1d23', color: accountName ? 'var(--txt)' : 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {accountNameLoading ? (
                          <>
                            <div style={{ width: 12, height: 12, border: '2px solid var(--border)', borderTop: '2px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                            Resolving...
                          </>
                        ) : accountNameError ? (
                          <span style={{ color: '#ff6b6b' }}>{accountNameError}</span>
                        ) : accountName ? (
                          accountName
                        ) :
                          'Account name'
                        }
                      </div>
                    </label>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                      <button
                        style={btnPrimary}
                        disabled={payLoading || !bankCode || banksLoading || !accountName}
                      >
                        {payLoading ? 'Saving…' : 'Save Payout & Show Summary'}
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* FINAL SUMMARY (countdown starts here) */}
              {initData && showFinalSummary && payData && (
                <div style={successCard}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}></h3>
                    <div style={badge}>
                      ⏱ {expired ? 'Expired' : countdown} <span style={{ opacity: .6 }}>of 10:00</span>
                    </div>
                  </div>

                  {/* Enhanced deposit details section with QR code */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 16,
                    alignItems: 'start',
                    background: '#0a0b0f',
                    padding: 16,
                    borderRadius: 12,
                    border: '1px solid var(--border)'
                  }}>
                    <div style={{ display: 'grid', gap: 12 }}>
                      <h4 style={{ margin: 0, fontSize: 14, color: 'var(--accent)' }}>📍 Deposit Details</h4>

                      <div>
                        <div style={kStyle}>Deposit Address</div>
                        <div style={{ ...vStyle, ...mono, wordBreak: 'break-all', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ flex: 1 }}>{initData.deposit.address}</span>
                          <button
                            onClick={() => copyToClipboard(initData.deposit.address, 'addr2')}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              opacity: copiedKey === 'addr2' ? 0.5 : 1
                            }}
                            title="Copy address"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z" fill="currentColor"/>
                            </svg>
                          </button>
                        </div>
                      </div>

                      {!!initData.deposit.memo && (
                        <div>
                          <div style={kStyle}>Memo / Tag</div>
                          <div style={{ ...vStyle, ...mono, wordBreak: 'break-all', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ flex: 1 }}>{initData.deposit.memo}</span>
                            <button
                              onClick={() => copyToClipboard(initData.deposit.memo!, 'memo2')}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: copiedKey === 'memo2' ? 0.5 : 1
                              }}
                              title="Copy memo"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z" fill="currentColor"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}

                      <div style={{ ...smallMuted, ...badgeWarn }}>
                        ⚠️ Send exactly {prettyAmount(initData.deposit.amount)} {initData.deposit.token} on {toNetworkLabel(initData.deposit.token, initData.deposit.network)} before the timer runs out.
                      </div>
                    </div>

                    {/* QR Code */}
                    <QRCode data={qrData} size={80} />
                  </div>

                  {/* Transaction info grid */}
                  <div style={kvGrid}>
                    <div>
                      <div style={kStyle}>Status</div>
                      <div style={vStyle}>{payData.status}</div>
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
                      <div style={vStyle}>{payData.payout.bankName}</div>
                    </div>
                    <div>
                      <div style={kStyle}>Account</div>
                      <div style={vStyle}>{payData.payout.accountName} — {payData.payout.accountNumber}</div>
                    </div>
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
              ? ''
              : ''}
          </div>
        </div>
      </div>

      {/* Tiny animation keyframes */}
      <style>
        {`@keyframes scaleIn{from{transform:translateY(8px) scale(.98); opacity:.0} to{transform:none; opacity:1}} @keyframes spin{from{transform:rotate(0deg)} to{transform:rotate(360deg)}}`}
      </style>
    </div>,
    document.body
  )
}