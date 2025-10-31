// src/MobileSell.tsx
import React, { useEffect, useRef, useState } from 'react'
import { tokenStore } from './lib/secureStore'
import './sell-modal-responsive.css'
import scannerIcon from './assets/scanner.png'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'

type BankOption = { name: string; code: string }

type InitiateSellRes = {
  success: boolean
  paymentId: string
  reference?: string
  token?: string
  network?: string
  sellAmount?: number
  deposit: {
    address: string
    memo?: string | null
    token: string
    network: string
    amount?: number
  }
  quote: {
    rate: number
    receiveCurrency: string
    receiveAmount: number
    breakdown?: {
      displayFeeNgn: number
    }
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

// Countdown removed — no timeouts

function friendlyError(_: any, fallback: string) {
  return 'Service unavailable. Please try again.'
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
  const recv = init?.quote?.receiveAmount ?? p.quote?.receiveAmount
  const rate = init?.quote?.rate ?? p.quote?.rate

  return [
    `Payout details saved 🏦`,
    `Bank: ${p.payout.bankName}`,
    `Account: ${p.payout.accountName} — ${p.payout.accountNumber}`,
    '',
    `Deposit to your address on **${netLabel}**.`,
    `You'll receive: **${prettyNgn(Number(recv || 0))}** at **${prettyAmount(Number(rate || 0))} NGN/${t}** when your deposit confirms.`,
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

export default function MobileSell({ open, onClose, onChatEcho, onStartInteraction }: MobileSellProps) {
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1 (Start Sell)
  const [token, setToken] = useState<TokenSym>('USDT')
  const [network, setNetwork] = useState(NETWORKS_BY_TOKEN['USDT'][0].code)
  // Optional estimation inputs
  const [currency, setCurrency] = useState<'TOKEN' | 'NGN'>('TOKEN')
  const [amount, setAmount] = useState<string>('')
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

  // No countdown

  // Banks
  const [banksLoading, setBanksLoading] = useState(false)
  const [banksError, setBanksError] = useState<string | null>(null)
  const [bankOptions, setBankOptions] = useState<BankOption[]>([])

  // OCR Scan
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const banksFetchedRef = useRef(false)



  // Reset on open
  useEffect(() => {
    if (!open) return
    setStep(1)
    setToken('USDT')
    setNetwork(NETWORKS_BY_TOKEN['USDT'][0].code)

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
    setCurrency('TOKEN')
    setAmount('')
    setNairaAmount('')
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
          setBanksError(friendlyError(e, 'Failed to load banks'))
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
        setAccountNameError(friendlyError(err, 'Failed to resolve account name'))
      } finally {
        setAccountNameLoading(false)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [open, step, bankCode, accountNumber])

  async function submitInitiate(e: React.FormEvent) {
    e.preventDefault()
    setInitError(null)

    setInitLoading(true)
    try {
      const res = await fetch(`${API_BASE}/sell/initiate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          token,
          network,
          ...(currency === 'TOKEN' && amount && !isNaN(+amount) && +amount > 0 ? { sellAmount: +amount, currency } : {}),
          ...(currency === 'NGN' && nairaAmount && !isNaN(+nairaAmount.replace(/,/g, '')) && +nairaAmount.replace(/,/g, '') > 0
            ? { sellAmount: +nairaAmount.replace(/,/g, ''), currency }
            : {})
        }),
      })
      const data: InitiateSellRes = await res.json()
      if (!res.ok || !data.success) throw new Error(data?.message || `HTTP ${res.status}`)
      setInitData(data)
      setStep(2)
    } catch (err: any) {
      setInitError(friendlyError(err, 'Failed to initiate sell'))
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
    } catch (err: any) {
      setPayError(friendlyError(err, 'Failed to save payout details'))
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
      background: 'rgba(0, 0, 0, 0.5)',
      zIndex: 1000,
      display: 'grid',
      placeItems: 'start center',
      padding: '16px',
      overflow: 'hidden',
      touchAction: 'none'
    }} onClick={onClose}>
      <div style={{
        maxWidth: '420px',
        width: '100%',
        maxHeight: '80vh',
        marginTop: '2vh',
        marginLeft: 'auto',
        marginRight: 'auto',
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: '6.84px',
        padding: '20.52px',
        boxShadow: 'none',
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
        <div style={{ marginBottom: '16px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 600, color: 'var(--txt)' }}>
              {step === 1 ? 'Start a Payment' : 'Payout Details'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: '8px' }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: step >= 1 ? 'var(--accent)' : 'var(--border)' }}></span>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: step >= 2 ? 'var(--accent)' : 'var(--border)' }}></span>
            </div>
          </div>
          <button
            style={{
              appearance: 'none',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--muted)',
              padding: '4px 8px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: '14px',
              alignSelf: 'flex-start'
            }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {/* STEP 1 — Start a Payment */}
          {step === 1 && (
            <div className="mobile-sell-section">


              {!!initError && (
                <div className="mobile-sell-error">
                  <strong>Error:</strong> {initError}
                </div>
              )}

              <form onSubmit={submitInitiate} className="mobile-sell-form">
                {/* Token and Network on same line */}
                <div className="mobile-sell-row">
                  <label className="mobile-sell-input-wrap">
                    <span className="mobile-sell-label">Token <span style={{ fontSize: '10px', opacity: 0.7 }}>▼</span></span>
                    <select
                      ref={firstInputRef as any}
                      className="mobile-sell-input"
                      value={token}
                      onChange={e => {
                        setToken(e.target.value as TokenSym)
                        onStartInteraction?.()
                      }}
                    >
                      {TOKENS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>

                  <label className="mobile-sell-input-wrap">
                    <span className="mobile-sell-label">Network <span style={{ fontSize: '10px', opacity: 0.7 }}>▼</span></span>
                    <select
                      className="mobile-sell-input"
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

                {/* Optional Currency and Amount */}
                <div className="mobile-sell-row">
                  <label className="mobile-sell-input-wrap">
                    <span className="mobile-sell-label">Currency <span style={{ fontSize: '10px', opacity: 0.7 }}>▼</span></span>
                    <select
                      className="mobile-sell-input"
                      value={currency}
                      onChange={e => setCurrency(e.target.value as 'TOKEN' | 'NGN')}
                    >
                      <option value="TOKEN">{token}</option>
                      <option value="NGN">NGN</option>
                    </select>
                  </label>

                  {currency === 'TOKEN' ? (
                    <label className="mobile-sell-input-wrap">
                      <span className="mobile-sell-label">Amount ({token})</span>
                      <input
                        className="mobile-sell-input"
                        inputMode="decimal"
                        placeholder={`e.g. 100`}
                        value={amount}
                        onChange={e => {
                          setAmount(e.target.value)
                          onStartInteraction?.()
                        }}
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
                          const cleanValue = e.target.value.replace(/[^\d.]/g, '')
                          setNairaAmount(cleanValue)
                        }}
                        onBlur={e => {
                          const num = parseFloat(e.target.value)
                          if (!isNaN(num) && num > 0) setNairaAmount(num.toLocaleString('en-US'))
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
                      {!!(initData.deposit.amount && initData.deposit.amount > 0) && (
                        <div className="mobile-sell-grid-item">
                          <div className="mobile-sell-key">Amount to Send</div>
                          <div className="mobile-sell-value">
                            {prettyAmount(initData.deposit.amount!)} {initData.deposit.token}
                          </div>
                        </div>
                      )}
                      {!!(initData.quote.receiveAmount && initData.quote.receiveAmount > 0) && (
                        <div className="mobile-sell-grid-item">
                          <div className="mobile-sell-key">You Receive</div>
                          <div className="mobile-sell-value">
                            {prettyNgn(initData.quote.receiveAmount)} ({initData.quote.receiveCurrency})
                          </div>
                        </div>
                      )}
                      <div className="mobile-sell-grid-item">
                        <div className="mobile-sell-key">Your Address</div>
                        <div className="mobile-sell-value mono wrap">{initData.deposit.address}</div>
                      </div>
                      {!!initData.deposit.memo && (
                        <div className="mobile-sell-grid-item">
                          <div className="mobile-sell-key">Memo/Tag</div>
                          <div className="mobile-sell-value mono wrap">{initData.deposit.memo}</div>
                        </div>
                      )}
                      <div className="mobile-sell-grid-item">
                        <div className="mobile-sell-key">Rate</div>
                        <div className="mobile-sell-value">{prettyAmount(initData.quote.rate)} NGN/{initData.deposit.token}</div>
                      </div>
                      {/* Camera Scan for Bank + Account Number (under Rate) */}
                      <div className="mobile-sell-grid-item">
                        <div className="mobile-sell-key">Scan account</div>
                        <div className="mobile-sell-value" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            id="account-scan-input"
                            type="file"
                            accept="image/*"
                            capture="environment"
                            style={{ display: 'none' }}
                            onChange={async (e) => {
                              const file = e.currentTarget.files?.[0]
                              if (!file) return

                              setOcrLoading(true)
                              setOcrError(null)

                              try {
                                // Compress/resize image before sending to reduce payload size
                                const compressImage = (file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<string> => {
                                  return new Promise((resolve, reject) => {
                                    const img = new Image()
                                    img.onload = () => {
                                      const canvas = document.createElement('canvas')
                                      let width = img.width
                                      let height = img.height

                                      if (width > maxWidth) {
                                        height = (height * maxWidth) / width
                                        width = maxWidth
                                      }

                                      canvas.width = width
                                      canvas.height = height
                                      const ctx = canvas.getContext('2d')
                                      if (!ctx) return reject(new Error('Canvas context not available'))

                                      ctx.drawImage(img, 0, 0, width, height)
                                      canvas.toBlob((blob) => {
                                        if (!blob) return reject(new Error('Image compression failed'))
                                        const reader = new FileReader()
                                        reader.onload = () => resolve(String(reader.result || ''))
                                        reader.onerror = reject
                                        reader.readAsDataURL(blob)
                                      }, 'image/jpeg', quality)
                                    }
                                    img.onerror = reject
                                    img.src = URL.createObjectURL(file)
                                  })
                                }

                                // Compress image first
                                const imageDataUrl = await compressImage(file)

                                console.log('Sending image to scan endpoint, size:', Math.round(imageDataUrl.length / 1024), 'KB')

                                // Send image directly to backend AI
                                const resp = await fetch(`${API_BASE}/scan/image`, {
                                  method: 'POST',
                                  headers: getHeaders(),
                                  body: JSON.stringify({ imageDataUrl })
                                })

                                console.log('Scan response status:', resp.status)

                                if (!resp.ok) {
                                  const errorText = await resp.text().catch(() => '')
                                  console.error('Scan failed:', resp.status, errorText)
                                  setOcrError(`Scan failed (${resp.status}). Please try again.`)
                                  return
                                }

                                const payload = await resp.json().catch((err) => {
                                  console.error('Failed to parse response:', err)
                                  return { success: false }
                                })

                                if (!payload.success) {
                                  setOcrError(payload.message || 'Could not extract account details.')
                                  return
                                }

                                const detected = payload.detected || {}
                                const detectedAcct = String(detected.accountNumber || '').trim()

                                // Use bankMatch from backend if available (backend already did fuzzy matching)
                                if (payload.bankMatch?.matched && payload.bankMatch?.code) {
                                  setBankCode(payload.bankMatch.code)
                                  setBankName(payload.bankMatch.matched)
                                  console.log('Scan: Using matched bank from backend', {
                                    original: payload.bankMatch.original,
                                    matched: payload.bankMatch.matched,
                                    code: payload.bankMatch.code,
                                    score: payload.bankMatch.score
                                  })
                                } else if (detected.bankName && bankOptions.length > 0) {
                                  // Fallback: try to find in frontend bank list
                                  const detectedBank = String(detected.bankName || '').toLowerCase().trim()
                                  const hit = bankOptions.find((b: BankOption) => {
                                    const bn = String(b.name || '').toLowerCase()
                                    return bn === detectedBank || bn.includes(detectedBank) || detectedBank.includes(bn)
                                  })
                                  if (hit) {
                                    setBankCode(hit.code)
                                    setBankName(hit.name)
                                  } else {
                                    // Backend couldn't match, and frontend also couldn't find it
                                    setOcrError(`Bank "${detected.bankName}" not found. Please select manually.`)
                                  }
                                }

                                // Fill account number (must be 10 digits)
                                if (/^\d{10}$/.test(detectedAcct)) {
                                  setAccountNumber(detectedAcct)
                                } else if (detectedAcct) {
                                  setOcrError(`Invalid account number: "${detectedAcct}". Must be 10 digits.`)
                                }

                              } catch (err: any) {
                                console.error('Scan flow failed', err)
                                setOcrError(err.message || 'Failed to scan image. Please try again.')
                              } finally {
                                setOcrLoading(false)
                                try { e.currentTarget.value = '' } catch { }
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="mobile-sell-button outline"
                            onClick={() => {
                              const el = document.getElementById('account-scan-input') as HTMLInputElement | null
                              el?.click()
                            }}
                            disabled={ocrLoading}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '8px',
                              minWidth: '44px',
                              height: '44px'
                            }}
                            title={ocrLoading ? 'Scanning...' : 'Scan with Camera'}
                          >
                            <img
                              src={scannerIcon}
                              alt="Scan"
                              style={{
                                width: '24px',
                                height: '24px',
                                opacity: ocrLoading ? 0.5 : 1
                              }}
                            />
                          </button>
                          {ocrError && (
                            <div className="mobile-sell-error" style={{ marginTop: '8px', fontSize: '13px', color: '#ff6b6b' }}>
                              ⚠️ {ocrError}
                            </div>
                          )}
                        </div>
                      </div>
                      {initData?.quote?.breakdown?.displayFeeNgn != null && (
                        <div className="mobile-sell-grid-item">
                          <div className="mobile-sell-key">Fee</div>
                          <div className="mobile-sell-value">{prettyNgn(initData.quote.breakdown.displayFeeNgn)}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {!!payError && (
                    <div className="mobile-sell-error">
                      <strong>Error:</strong> {payError}
                    </div>
                  )}

                  <form id="payout-form" onSubmit={submitPayout} className="mobile-sell-form">

                    <label className="mobile-sell-input-wrap">
                      <span className="mobile-sell-label">Bank <span style={{ fontSize: '10px', opacity: 0.7 }}>▼</span></span>
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

                  </form>
                </>
              )}

              {/* FINAL SUMMARY (countdown starts here) */}
              {initData && showFinalSummary && payData && (
                <div className="mobile-sell-success-card">
                  <div className="mobile-sell-success-header">
                    <h3 className="mobile-sell-card-title"></h3>
                  </div>

                  {/* Enhanced deposit details section with QR code */}
                  <div className="mobile-sell-deposit-section">
                    <div className="mobile-sell-deposit-details">
                      <h4 className="mobile-sell-deposit-title">📍 Deposit Details</h4>

                      <div>
                        <div className="mobile-sell-key">Deposit Address</div>
                        <div className="mobile-sell-value mono wrap" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                              <path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z" fill="currentColor" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {!!initData.deposit.memo && (
                        <div>
                          <div className="mobile-sell-key">Memo / Tag</div>
                          <div className="mobile-sell-value mono wrap" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                                <path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z" fill="currentColor" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="mobile-sell-warning">
                        ⚠️ Send {initData.deposit.token} on {toNetworkLabel(initData.deposit.token, initData.deposit.network)} to your address above. Any amount you send will be credited at the live rate.
                      </div>
                    </div>

                    {/* QR Code */}
                    <QRCode data={qrData} size={80} />
                  </div>

                  {/* Transaction info grid */}
                  <div className="mobile-sell-grid mobile-sell-summary-grid">
                    <div className="mobile-sell-grid-item">
                      <div className="mobile-sell-key">Status</div>
                      <div className="mobile-sell-value">{payData.status}</div>
                    </div>

                    <div className="mobile-sell-grid-item">
                      <div className="mobile-sell-key">Rate</div>
                      <div className="mobile-sell-value">{prettyAmount(initData.quote.rate)} NGN/{initData.deposit.token}</div>
                    </div>
                    <div className="mobile-sell-grid-item">
                      <div className="mobile-sell-key">Bank</div>
                      <div className="mobile-sell-value">{payData.payout.bankName}</div>
                    </div>
                    <div className="mobile-sell-grid-item">
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
              ? ''
              : ''}
          </div>
          <div className="mobile-sell-button-row">
            {step === 2 ? (
              !showFinalSummary ? (
                <button
                  className="mobile-sell-button primary"
                  type="submit"
                  form="payout-form"
                  disabled={payLoading || !bankCode || banksLoading || !accountName}
                >
                  {payLoading ? 'Saving…' : 'Save Payout & Show Summary'}
                </button>
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
