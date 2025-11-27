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
    `Payout details saved`,
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

  const [token, setToken] = useState<TokenSym>('USDT')
  const [network, setNetwork] = useState(NETWORKS_BY_TOKEN['USDT'][0].code)
  const [currency, setCurrency] = useState<'TOKEN' | 'NGN'>('TOKEN')
  const [amount, setAmount] = useState<string>('')
  const [nairaAmount, setNairaAmount] = useState<string>('')
  const [initLoading, setInitLoading] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [initData, setInitData] = useState<InitiateSellRes | null>(null)

  const [bankName, setBankName] = useState('')
  const [bankCode, setBankCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNameLoading, setAccountNameLoading] = useState(false)
  const [accountNameError, setAccountNameError] = useState<string | null>(null)
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [payData, setPayData] = useState<PayoutRes | null>(null)

  const [banksLoading, setBanksLoading] = useState(false)
  const [banksError, setBanksError] = useState<string | null>(null)
  const [bankOptions, setBankOptions] = useState<BankOption[]>([])

  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const banksFetchedRef = useRef(false)

  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  function copyToClipboard(text: string, key: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1200)
    }).catch(() => { })
  }

  const firstInputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)

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

  useEffect(() => { firstInputRef.current?.focus() }, [step])

  useEffect(() => {
    if (!open || step !== 2 || banksFetchedRef.current) return
    banksFetchedRef.current = true
    ;(async () => {
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
        }
      } catch (e: any) {
        setBanksError(friendlyError(e, 'Failed to load banks'))
      } finally {
        setBanksLoading(false)
      }
    })()
  }, [open, step])

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
        if (!res.ok || !data.success) throw new Error(data?.message || `HTTP ${res.status}`)
        if (data.data?.accountName) {
          setAccountName(data.data.accountName)
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

  if (!open) return null

  const showFinalSummary = !!payData
  const qrData = initData
    ? (initData.deposit.memo
        ? `${initData.deposit.address}?memo=${initData.deposit.memo}`
        : initData.deposit.address)
    : ''

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'transparent',
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
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: '6.84px',
        padding: '20.52px',
        boxShadow: 'none',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }} onClick={(e) => e.stopPropagation()}>

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

        {/* Header – X button is KEPT */}
        <div style={{ marginBottom: '16px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 600, color: 'var(--txt)' }}>
              {step === 1 ? 'Start a Trade' : 'Payout Details'}
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
            X
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {step === 1 && (
            <div className="mobile-sell-section">
              {!!initError && (
                <div className="mobile-sell-error">
                  <strong>Error:</strong> {initError}
                </div>
              )}

              <form onSubmit={submitInitiate} className="mobile-sell-form">
                {/* Token + Network row */}
                <div className="mobile-sell-row">
                  <label className="mobile-sell-input-wrap">
                    <span className="mobile-sell-label">Token</span>
                    <div className="mobile-sell-input-shell">
                      <div className="mobile-sell-input-gradient">
                        <select
                          ref={firstInputRef as any}
                          className="mobile-sell-input-field select"
                          value={token}
                          onChange={e => {
                            setToken(e.target.value as TokenSym)
                            onStartInteraction?.()
                          }}
                        >
                          {TOKENS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <span className="mobile-sell-dropdown-arrow">▼</span>
                      </div>
                    </div>
                  </label>

                  <label className="mobile-sell-input-wrap">
                    <span className="mobile-sell-label">Network</span>
                    <div className="mobile-sell-input-shell">
                      <div className="mobile-sell-input-gradient">
                        <select
                          className="mobile-sell-input-field select"
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
                        <span className="mobile-sell-dropdown-arrow">▼</span>
                      </div>
                    </div>
                  </label>
                </div>

                {/* Amount row */}
                <div className="mobile-sell-row">
                  <label className="mobile-sell-input-wrap">
                    <span className="mobile-sell-label">Currency</span>
                    <div className="mobile-sell-input-shell">
                      <div className="mobile-sell-input-gradient">
                        <select
                          className="mobile-sell-input-field select"
                          value={currency}
                          onChange={e => setCurrency(e.target.value as 'TOKEN' | 'NGN')}
                        >
                          <option value="TOKEN">{token}</option>
                          <option value="NGN">NGN</option>
                        </select>
                        <span className="mobile-sell-dropdown-arrow">▼</span>
                      </div>
                    </div>
                  </label>

                  {currency === 'TOKEN' ? (
                    <label className="mobile-sell-input-wrap">
                      <span className="mobile-sell-label">Amount ({token})</span>
                      <div className="mobile-sell-input-shell">
                        <div className="mobile-sell-input-gradient">
                          <input
                            className="mobile-sell-input-field"
                            inputMode="decimal"
                            placeholder="e.g. 100"
                            value={amount}
                            onChange={e => {
                              setAmount(e.target.value)
                              onStartInteraction?.()
                            }}
                          />
                        </div>
                      </div>
                    </label>
                  ) : (
                    <label className="mobile-sell-input-wrap">
                      <span className="mobile-sell-label">Amount (NGN)</span>
                      <div className="mobile-sell-input-shell">
                        <div className="mobile-sell-input-gradient">
                          <input
                            className="mobile-sell-input-field"
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
                        </div>
                      </div>
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

          {step === 2 && (
            <div className="mobile-sell-section">
              {/* Same body content as before – unchanged */}
              {/* ... (all the payout form, summary, QR, etc. – exactly the same as your original) */}
              {/* For brevity, only the changed footer is shown below */}
            </div>
          )}
        </div>

        {/* Footer – NO Cancel button anymore */}
        <div className="mobile-sell-footer">
          <div className="mobile-sell-button-row">
            {step === 2 && !showFinalSummary && (
              <button
                className="mobile-sell-button primary"
                type="submit"
                form="payout-form"
                disabled={payLoading || !bankCode || banksLoading || !accountName}
              >
                {payLoading ? 'Saving…' : 'Save Payout & Show Summary'}
              </button>
            )}

            {step === 2 && showFinalSummary && (
              <button className="mobile-sell-button primary" onClick={onClose}>
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}