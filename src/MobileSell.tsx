// src/MobileSell.tsx
import React, { useEffect, useRef, useState } from 'react'
import { tokenStore } from './lib/secureStore'
import './sell-modal-responsive.css'

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

type MobileSellProps = {
  open: boolean
  onClose: () => void
  onChatEcho?: (text: string) => void
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

function QRCode({ data, size = 120 }: { data: string; size?: number }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&format=svg&bgcolor=0f1117&color=ffffff&margin=10`

  return (
    <div className="mobile-qr-container">
      <img
        src={qrUrl}
        alt="QR Code for deposit address"
        className="mobile-qr-code"
        style={{ width: size, height: size }}
      />
      <div className="mobile-qr-label">Scan to copy address</div>
    </div>
  )
}

export default function MobileSell({ open, onClose, onChatEcho }: MobileSellProps) {
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

    let amountNum: number

    if (currency === 'TOKEN') {
      if (!amount || isNaN(+amount) || +amount <= 0) {
        setInitError('Enter a valid token amount')
        return
      }
      amountNum = +amount
    } else {
      // Remove commas for validation
      const cleanNairaAmount = nairaAmount.replace(/,/g, '');
      if (!cleanNairaAmount || isNaN(+cleanNairaAmount) || +cleanNairaAmount <= 0) {
        setInitError('Enter a valid Naira amount')
        return
      }
      amountNum = +cleanNairaAmount
    }

    setInitLoading(true)
    try {
      const res = await fetch(`${API_BASE}/sell/initiate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ token, network, sellAmount: amountNum, currency }),
      })
      const data: InitiateSellRes = await res.json()
      if (!res.ok || !data.success) throw new Error(data?.message || `HTTP ${res.status}`)
      setInitData(data)
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

  return (
    <div style={{ 
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
      padding: '16px 12px',
      overflow: 'hidden',
      touchAction: 'none'
    }} onClick={onClose}>
      <div style={{ 
        maxWidth: '380px', 
        width: '100%',
        maxHeight: '70vh',
        marginTop: '6vh',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: 'var(--shadow)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }} onClick={(e) => e.stopPropagation()}>
        {/* Loading Overlay */}
        {(initLoading || payLoading || accountNameLoading || banksLoading) && (
          <div className="mobile-sell-loading-overlay">
            <div className="mobile-sell-loading-spinner"></div>
            <div className="mobile-sell-loading-text">
              {initLoading && 'Starting sell...'}
              {payLoading && 'Saving payout...'}
              {accountNameLoading && 'Validating account...'}
              {banksLoading && 'Loading banks...'}
            </div>
          </div>
        )}
        {/* Header */}
        <div style={{ marginBottom: '16px', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 600, color: 'var(--txt)' }}>
            {step === 1 ? 'Start a Payment' : step === 2 ? 'Payout Details' : 'Transaction Summary'}
          </h2>
          <p style={{ marginTop: '6px', color: 'var(--muted)', fontSize: '0.85rem' }}>
            {step === 1 ? 'Choose token, network, and amount. We\'ll capture payout next.' : 
             step === 2 ? 'Enter your bank details to receive payment.' : 
             'Review your transaction details before confirming.'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: '8px' }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: step >= 1 ? 'var(--accent)' : 'var(--border)' }}></span>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: step >= 2 ? 'var(--accent)' : 'var(--border)' }}></span>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: step >= 3 ? 'var(--accent)' : 'var(--border)' }}></span>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {/* STEP 1 — Start a Payment */}
          {step === 1 && (
            <div className="mobile-sell-section">
              <p className="mobile-sell-description">
                Choose token, network, and amount. We'll capture payout next.
              </p>


              {!!initError && (
                <div className="mobile-sell-error">
                  <strong>Error:</strong> {initError}
                </div>
              )}

              <form onSubmit={submitInitiate} className="mobile-sell-form">
                {/* Token and Network on same line */}
                <div className="mobile-sell-row">
                  <label className="mobile-sell-input-wrap">
                    <span className="mobile-sell-label">Token</span>
                    <div className="mobile-sell-select-wrapper">
                      <select
                        ref={firstInputRef as any}
                        className="mobile-sell-input"
                        value={token}
                        onChange={e => setToken(e.target.value as TokenSym)}
                      >
                        {TOKENS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <div className="mobile-sell-dropdown-arrow">▼</div>
                    </div>
                  </label>

                  <label className="mobile-sell-input-wrap">
                    <span className="mobile-sell-label">Network</span>
                    <div className="mobile-sell-select-wrapper">
                      <select
                        className="mobile-sell-input"
                        value={network}
                        onChange={e => setNetwork(e.target.value)}
                      >
                        {NETWORKS_BY_TOKEN[token].map(n => (
                          <option key={n.code} value={n.code}>{n.label}</option>
                        ))}
                      </select>
                      <div className="mobile-sell-dropdown-arrow">▼</div>
                    </div>
                  </label>
                </div>

                {/* Currency and Amount on same line */}
                <div className="mobile-sell-row">
                  <label className="mobile-sell-input-wrap">
                    <span className="mobile-sell-label">Currency</span>
                    <div className="mobile-sell-select-wrapper">
                      <select
                        className="mobile-sell-input"
                        value={currency}
                        onChange={e => setCurrency(e.target.value as 'TOKEN' | 'NGN')}
                      >
                        <option value="TOKEN">{token}</option>
                        <option value="NGN">NGN</option>
                      </select>
                      <div className="mobile-sell-dropdown-arrow">▼</div>
                    </div>
                  </label>

                  {currency === 'TOKEN' ? (
                    <label className="mobile-sell-input-wrap">
                      <span className="mobile-sell-label">Amount ({token})</span>
                      <input
                        className="mobile-sell-input"
                        inputMode="decimal"
                        placeholder="e.g. 100"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                      />
                    </label>
                  ) : (
                    <label className="mobile-sell-input-wrap">
                      <span className="mobile-sell-label">Amount (NGN)</span>
                      <input
                        className="mobile-sell-input"
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

                <div className="mobile-sell-button-row">
                  <button className="mobile-sell-button primary" disabled={initLoading}>
                    {initLoading ? 'Starting…' : 'Start & Continue to Payout'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 2 — Payout (then Summary with countdown) */}
          {step === 2 && (
            <div className="mobile-sell-section">
              {!initData && (
                <div className="mobile-sell-error">
                  Missing sell reference — please restart.
                </div>
              )}

              {initData && !showFinalSummary && (
                <>
                  <div className="mobile-sell-card">
                    <h3 className="mobile-sell-card-title">Sell Summary</h3>
                    <div className="mobile-sell-grid">
                      <div>
                        <div className="mobile-sell-key">Amount to Send</div>
                        <div className="mobile-sell-value">
                          {prettyAmount(initData.deposit.amount)} {initData.deposit.token}
                        </div>
                      </div>
                      <div>
                        <div className="mobile-sell-key">You Receive</div>
                        <div className="mobile-sell-value">
                          {prettyNgn(initData.quote.receiveAmount)} ({initData.quote.receiveCurrency})
                        </div>
                      </div>
                      <div>
                        <div className="mobile-sell-key">Rate</div>
                        <div className="mobile-sell-value">{prettyAmount(initData.quote.rate)} NGN/{initData.deposit.token}</div>
                      </div>
                    </div>
                  </div>

                  {!!payError && (
                    <div className="mobile-sell-error">
                      <strong>Error:</strong> {payError}
                    </div>
                  )}

                  <form onSubmit={submitPayout} className="mobile-sell-form">

                    <label className="mobile-sell-input-wrap">
                      <span className="mobile-sell-label">Bank</span>
                      <div className="mobile-sell-select-wrapper">
                        <select
                          ref={firstInputRef as any}
                          className="mobile-sell-input"
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
                        <div className="mobile-sell-dropdown-arrow">▼</div>
                      </div>
                    </label>

                    <label className="mobile-sell-input-wrap">
                      <span className="mobile-sell-label">Account Number</span>
                      <input
                        className="mobile-sell-input"
                        value={accountNumber}
                        onChange={e => setAccountNumber(e.target.value)}
                        placeholder="e.g. 0123456789"
                      />
                    </label>

                    <label className="mobile-sell-input-wrap full-width">
                      <span className="mobile-sell-label">Account Name</span>
                      <div className={`mobile-sell-account-name ${accountNameError ? 'error' : ''}`}>
                        {accountNameLoading ? (
                          <>
                            <div className="mobile-sell-spinner"></div>
                            Resolving...
                          </>
                        ) : accountNameError ? (
                          accountNameError
                        ) : accountName ? (
                          accountName
                        ) :
                          'Account name'
                        }
                      </div>
                    </label>

                    <div className="mobile-sell-button-row">
                      <button
                        className="mobile-sell-button primary"
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
                <div className="mobile-sell-success-card">
                  <div className="mobile-sell-success-header">
                    <h3 className="mobile-sell-card-title">Transaction Summary</h3>
                    <div className="mobile-sell-countdown">
                      ⏱ {expired ? 'Expired' : countdown} <span>of 10:00</span>
                    </div>
                  </div>

                  {/* Enhanced deposit details section with QR code */}
                  <div className="mobile-sell-deposit-section">
                    <div className="mobile-sell-deposit-details">
                      <h4 className="mobile-sell-deposit-title">📍 Deposit Details</h4>

                      <div>
                        <div className="mobile-sell-key">Deposit Address</div>
                        <div className="mobile-sell-value mono wrap">
                          {initData.deposit.address}
                        </div>
                        <div className="mobile-sell-button-row">
                          <button
                            className="mobile-sell-button outline"
                            onClick={() => copyToClipboard(initData.deposit.address, 'addr2')}
                          >
                            {copiedKey === 'addr2' ? 'Copied ✓' : 'Copy Address'}
                          </button>
                        </div>
                      </div>

                      {!!initData.deposit.memo && (
                        <div>
                          <div className="mobile-sell-key">Memo / Tag</div>
                          <div className="mobile-sell-value mono wrap">
                            {initData.deposit.memo}
                          </div>
                          <div className="mobile-sell-button-row">
                            <button
                              className="mobile-sell-button outline"
                              onClick={() => copyToClipboard(initData.deposit.memo!, 'memo2')}
                            >
                              {copiedKey === 'memo2' ? 'Copied ✓' : 'Copy Memo'}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="mobile-sell-warning">
                        ⚠️ Send exactly {prettyAmount(initData.deposit.amount)} {initData.deposit.token} on {toNetworkLabel(initData.deposit.token, initData.deposit.network)} before the timer runs out.
                      </div>
                    </div>

                    {/* QR Code */}
                    <QRCode data={qrData} size={120} />
                  </div>

                  {/* Transaction info grid */}
                  <div className="mobile-sell-grid">
                    <div>
                      <div className="mobile-sell-key">Status</div>
                      <div className="mobile-sell-value">{payData.status}</div>
                    </div>
                    <div>
                      <div className="mobile-sell-key">You Receive</div>
                      <div className="mobile-sell-value">
                        {prettyNgn((initData.quote.receiveAmount) || 0)} ({initData.quote.receiveCurrency})
                      </div>
                    </div>
                    <div>
                      <div className="mobile-sell-key">Rate</div>
                      <div className="mobile-sell-value">{prettyAmount(initData.quote.rate)} NGN/{initData.deposit.token}</div>
                    </div>
                    <div>
                      <div className="mobile-sell-key">Bank</div>
                      <div className="mobile-sell-value">{payData.payout.bankName}</div>
                    </div>
                    <div>
                      <div className="mobile-sell-key">Account</div>
                      <div className="mobile-sell-value">{payData.payout.accountName} — {payData.payout.accountNumber}</div>
                    </div>
                  </div>

                  <div className="mobile-sell-button-row">
                    <button className="mobile-sell-button primary" onClick={onClose}>Done</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mobile-sell-footer">
          <div className="mobile-sell-footer-text">
            {step === 1
              ? 'We\'ll capture your payout next.'
              : (showFinalSummary
                ? 'Copy the deposit details and send the exact amount within the window.'
                : 'Ensure your bank details match your account name.')}
          </div>
          <div className="mobile-sell-button-row">
            {step === 2 ? (
              !showFinalSummary ? (
                <button className="mobile-sell-button outline" onClick={() => setStep(1)}>← Back</button>
              ) : (
                <button className="mobile-sell-button outline" onClick={onClose}>Close</button>
              )
            ) : (
              <button className="mobile-sell-button outline" onClick={onClose}>Cancel</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
