import React, { useEffect, useRef, useState } from 'react'
import { tokenStore } from './lib/secureStore'
import { authFetch, getAuthState, setupAutoLogoutTimer, clearAuth } from './lib/tokenManager' // ✅ Using authFetch
import './sell-modal-responsive.css'
import scannerIcon from './assets/scanner.png'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'

// --- Type Definitions (Kept Exactly as They Were) ---
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

// ❌ Removed the redundant getHeaders() function. All authenticated calls 
// now rely on the imported authFetch from tokenManager.

// --- Helper Functions ---
function prettyAmount(n: number) {
  return new Intl.NumberFormat('en-NG', { maximumFractionDigits: 8 }).format(n)
}

function prettyNgn(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(n)
}

function friendlyError(_: any, fallback: string) {
  // Check if the error is explicitly a 401 or 403 from the backend
  if (_ && typeof _.message === 'string' && (_.message.includes('401') || _.message.includes('403'))) {
    return 'Your session has expired. Please sign in again.'
  }
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

function QRCode({ data, size = 80 }: { data: string; size?: number }) {
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
  // --- Component State ---
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
  const firstInputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)
  
  // --- useEffect hooks (Cleanup and Setup) ---
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

  // Fetch banks (Assumed unauthenticated public endpoint - using standard fetch)
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

  // Resolve account name - ✅ Uses authFetch
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
        const res = await authFetch(
          `${API_BASE}/accountname/resolve?sortCode=${encodeURIComponent(bankCode)}&accountNumber=${encodeURIComponent(accountNumber)}`,
          {
            method: 'GET',
          }
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

  // --- Submit functions ---
  async function submitInitiate(e: React.FormEvent) {
    e.preventDefault()
    setInitError(null)
    setInitLoading(true)
    try {
      // ✅ Using authFetch for authenticated endpoint
      const res = await authFetch(`${API_BASE}/sell/initiate`, {
        method: 'POST',
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
      // ✅ Using authFetch for authenticated endpoint
      const res = await authFetch(`${API_BASE}/sell/payout`, {
        method: 'POST',
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

  // --- OCR and scan logic ---
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  function copyToClipboard(text: string, key: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1200)
    }).catch(() => { })
  }

  if (!open) return null

  const headerTitle = step === 1 ? 'Start a Trade' : (!payData ? 'Payout Details' : 'Transaction Summary')
  const showFinalSummary = !!payData
  const qrData = initData ? (initData.deposit.memo ? `${initData.deposit.address}?memo=${initData.deposit.memo}` : initData.deposit.address) : ''

  return (
    <div className="mobile-sell-overlay" onClick={onClose}>
      <div className="mobile-sell-container" onClick={(e) => e.stopPropagation()}>
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
        <div className="mobile-sell-header" style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <h2 className="mobile-sell-title">{headerTitle}</h2>
            <div className="mobile-sell-stepper" style={{ marginTop: '8px' }}>
              <span className={`mobile-sell-dot ${step >= 1 ? 'active' : ''}`}></span>
              <span className={`mobile-sell-dot ${step >= 2 ? 'active' : ''}`}></span>
            </div>
          </div>
          <button className="mobile-sell-close" onClick={onClose} style={{ appearance: 'none', border: 'none', background: 'transparent', color: '#ffffff', padding: '4px 8px', borderRadius: 8, cursor: 'pointer', fontSize: '14px', alignSelf: 'flex-start' }}>✕</button>
        </div>

        {/* Body */}
        <div className="mobile-sell-body" style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {step === 1 && (
            <div className="mobile-sell-section">
              {!!initError && <div className="mobile-sell-error"><strong>Error:</strong> {initError}</div>}
              <form id="start-sell-form" onSubmit={submitInitiate} className="mobile-sell-form">
                <div className="mobile-sell-row">
                  <label className="mobile-sell-input-wrap">
                    <span className="mobile-sell-label">Token <span style={{ fontSize: '10px', opacity: 0.7 }}>▼</span></span>
                    <select ref={firstInputRef as any} className="mobile-sell-input-field" value={token} onChange={e => { setToken(e.target.value as TokenSym); onStartInteraction?.() }}>
                      {TOKENS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                  <label className="mobile-sell-input-wrap">
                    <span className="mobile-sell-label">Network <span style={{ fontSize: '10px', opacity: 0.7 }}>▼</span></span>
                    <select className="mobile-sell-input-field" value={network} onChange={e => { setNetwork(e.target.value); onStartInteraction?.() }}>
                      {NETWORKS_BY_TOKEN[token].map(n => <option key={n.code} value={n.code}>{n.label}</option>)}
                    </select>
                  </label>
                </div>
                <div className="mobile-sell-row">
                  <label className="mobile-sell-input-wrap">
                    <span className="mobile-sell-label">Currency <span style={{ fontSize: '10px', opacity: 0.7 }}>▼</span></span>
                    <select className="mobile-sell-input-field" value={currency} onChange={e => setCurrency(e.target.value as 'TOKEN' | 'NGN')}>
                      <option value="TOKEN">{token}</option>
                      <option value="NGN">NGN</option>
                    </select>
                  </label>
                  {currency === 'TOKEN' ? (
                    <label className="mobile-sell-input-wrap">
                      <span className="mobile-sell-label">Amount ({token})</span>
                      <input className="mobile-sell-input-field" inputMode="decimal" placeholder={`e.g. 100`} value={amount} onChange={e => { setAmount(e.target.value); onStartInteraction?.() }} />
                    </label>
                  ) : (
                    <label className="mobile-sell-input-wrap">
                      <span className="mobile-sell-label">Amount (NGN)</span>
                      <input className="mobile-sell-input-field" inputMode="decimal" placeholder="e.g. 50,000" value={nairaAmount} onChange={e => setNairaAmount(e.target.value.replace(/[^\d.]/g, ''))} onBlur={e => { const num = parseFloat(e.target.value); if (!isNaN(num) && num > 0) setNairaAmount(num.toLocaleString('en-US')) }} />
                    </label>
                  )}
                </div>
              </form>
            </div>
          )}

          {step === 2 && (
            <div className="mobile-sell-section">
              {!initData && <div className="mobile-sell-error">Missing sell reference — please restart.</div>}
              {initData && !showFinalSummary && (
                <>
                  <div className="mobile-sell-success-card">
                    <div className="mobile-sell-success-header"><h3 className="mobile-sell-card-title"></h3></div>
                    <div className="mobile-sell-grid mobile-sell-summary-grid">
                      {!!(initData.deposit.amount && initData.deposit.amount > 0) && <div className="mobile-sell-grid-item"><div className="mobile-sell-key">Amount to Send</div><div className="mobile-sell-value">{prettyAmount(initData.deposit.amount!)} {initData.deposit.token}</div></div>}
                      {!!(initData.quote.receiveAmount && initData.quote.receiveAmount > 0) && <div className="mobile-sell-grid-item"><div className="mobile-sell-key">You Receive</div><div className="mobile-sell-value">{prettyNgn(initData.quote.receiveAmount)} ({initData.quote.receiveCurrency})</div></div>}
                      <div className="mobile-sell-grid-item"><div className="mobile-sell-key">Rate</div><div className="mobile-sell-value">{prettyAmount(initData.quote.rate)} NGN/{initData.deposit.token}</div></div>
                      <div className="mobile-sell-grid-item"><div className="mobile-sell-key">Scan account</div><div className="mobile-sell-value" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input id="account-scan-input" type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={async (e) => {
                          const file = e.currentTarget.files?.[0]; if (!file) return; setOcrLoading(true); setOcrError(null);
                          try {
                            const compressImage = (file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<string> => {
                              return new Promise((resolve, reject) => {
                                const img = new Image(); img.onload = () => {
                                  const canvas = document.createElement('canvas'); let width = img.width; let height = img.height;
                                  if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
                                  canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d');
                                  if (!ctx) return reject(new Error('Canvas context not available')); ctx.drawImage(img, 0, 0, width, height);
                                  canvas.toBlob((blob) => { if (!blob) return reject(new Error('Image compression failed')); const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = reject; reader.readAsDataURL(blob); }, 'image/jpeg', quality);
                                }; img.onerror = reject; img.src = URL.createObjectURL(file);
                              });
                            };
                            const imageDataUrl = await compressImage(file);
                            // ✅ Using authFetch for authenticated endpoint
                            const resp = await authFetch(`${API_BASE}/scan/image`, { 
                                method: 'POST', 
                                body: JSON.stringify({ imageDataUrl }) 
                            });
                            if (!resp.ok) { setOcrError(`Scan failed (${resp.status}). Please try again.`); return; }
                            const payload = await resp.json().catch(() => ({ success: false }));
                            if (!payload.success) { setOcrError(payload.message || 'Could not extract account details.'); return; }
                            const detected = payload.detected || {}; const detectedAcct = String(detected.accountNumber || '').trim();
                            let bankSet = false;
                            if (payload.bankMatch?.matched && payload.bankMatch?.code) { setBankCode(payload.bankMatch.code); setBankName(payload.bankMatch.matched); bankSet = true; }
                            else if (detected.bankName && bankOptions.length > 0) { const detectedBank = String(detected.bankName || '').toLowerCase().trim(); const hit = bankOptions.find((b) => { const bn = String(b.name || '').toLowerCase(); return bn === detectedBank || bn.includes(detectedBank) || detectedBank.includes(bn); }); if (hit) { setBankCode(hit.code); setBankName(hit.name); bankSet = true; } else { setOcrError(`Bank "${detected.bankName}" not found. Please select manually.`); } }
                            if (/^\d{10}$/.test(detectedAcct)) { if (bankSet) { setTimeout(() => { setAccountNumber(detectedAcct) }, 100) } else { setAccountNumber(detectedAcct) } } else if (detectedAcct) { setOcrError(`Invalid account number: "${detectedAcct}". Must be 10 digits.`); }
                          } catch (err: any) { setOcrError(err.message || 'Failed to scan image.'); } finally { setOcrLoading(false); try { e.currentTarget.value = '' } catch { } }
                        }} />
                        <button type="button" className="mobile-sell-button outline" onClick={() => { const el = document.getElementById('account-scan-input') as HTMLInputElement | null; el?.click(); }} disabled={ocrLoading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', minWidth: '52px', height: '52px', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.3)', background: 'transparent', color: '#ffffff' }}>
                          {ocrLoading ? <div style={{ width: '24px', height: '24px', border: '2px solid rgba(255, 255, 255, 0.3)', borderTop: '2px solid #ffffff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <img src={scannerIcon} alt="Scan" style={{ width: '24px', height: '24px' }} />}
                        </button>
                        {ocrError && <div className="mobile-sell-error" style={{ marginTop: '8px', fontSize: '13px', color: '#ff6b6b' }}>⚠️ {ocrError}</div>}
                      </div></div>
                      {initData?.quote?.breakdown?.displayFeeNgn != null && <div className="mobile-sell-grid-item"><div className="mobile-sell-key">Fee</div><div className="mobile-sell-value">{prettyNgn(initData.quote.breakdown.displayFeeNgn)}</div></div>}
                    </div>
                  </div>
                  {!!payError && <div className="mobile-sell-error"><strong>Error:</strong> {payError}</div>}
                  <form id="payout-form" onSubmit={submitPayout} className="mobile-sell-form">
                    <label className="mobile-sell-input-wrap"><span className="mobile-sell-label">Bank <span style={{ fontSize: '10px', opacity: 0.7 }}>▼</span></span>
                      <select ref={firstInputRef as any} className="mobile-sell-input-field" value={bankCode} disabled={banksLoading || bankOptions.length === 0} onChange={e => { const code = e.target.value; const hit = bankOptions.find(b => b.code === code); if (hit) { setBankCode(hit.code); setBankName(hit.name); } }}>
                        {bankOptions.length === 0 ? <option value="">{banksLoading ? 'Loading…' : (banksError || 'No banks')}</option> : bankOptions.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                      </select>
                    </label>
                    <label className="mobile-sell-input-wrap"><span className="mobile-sell-label">Account Number</span><input className="mobile-sell-input-field" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="e.g. 0123456789" /></label>
                    <label className="mobile-sell-input-wrap full-width"><span className="mobile-sell-label">Account Name</span><div className={`mobile-sell-account-name ${accountNameError ? 'error' : ''}`}>{accountNameLoading ? <><div className="mobile-sell-spinner"></div>Resolving...</> : accountNameError ? accountNameError : accountName ? accountName : 'Account name'}</div></label>
                  </form>
                </>
              )}
              {initData && showFinalSummary && payData && (
                <div className="mobile-sell-success-card">
                  <div className="mobile-sell-success-header"><h3 className="mobile-sell-card-title"></h3></div>
                  <div className="mobile-sell-deposit-section">
                    <div className="mobile-sell-deposit-details">
                      <h4 className="mobile-sell-deposit-title">📍 Deposit Details</h4>
                      <div><div className="mobile-sell-key">Deposit Address</div><div className="mobile-sell-value mono wrap" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ flex: 1 }}>{initData.deposit.address}</span><button onClick={() => copyToClipboard(initData.deposit.address, 'addr2')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: copiedKey === 'addr2' ? 0.5 : 1, color: 'currentColor' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z" fill="currentColor" /></svg></button></div></div>
                      {!!initData.deposit.memo && <div><div className="mobile-sell-key">Memo / Tag</div><div className="mobile-sell-value mono wrap" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ flex: 1 }}>{initData.deposit.memo}</span><button onClick={() => copyToClipboard(initData.deposit.memo!, 'memo2')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: copiedKey === 'memo2' ? 0.5 : 1, color: 'currentColor' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z" fill="currentColor" /></svg></button></div></div>}
                      <div className="mobile-sell-warning">⚠️ Send {initData.deposit.token} on {toNetworkLabel(initData.deposit.token, initData.deposit.network)} to your address above. Any amount you send will be credited at the live rate.</div>
                    </div>
                    <QRCode data={qrData} size={80} />
                  </div>
                  <div className="mobile-sell-grid mobile-sell-summary-grid">
                    <div className="mobile-sell-grid-item"><div className="mobile-sell-key">Status</div><div className="mobile-sell-value">{payData.status}</div></div>
                    <div className="mobile-sell-grid-item"><div className="mobile-sell-key">Rate</div><div className="mobile-sell-value">{prettyAmount(initData.quote.rate)} NGN/{initData.deposit.token}</div></div>
                    <div className="mobile-sell-grid-item"><div className="mobile-sell-key">Bank</div><div className="mobile-sell-value">{payData.payout.bankName}</div></div>
                    <div className="mobile-sell-grid-item"><div className="mobile-sell-key">Account</div><div className="mobile-sell-value">{payData.payout.accountName} — {payData.payout.accountNumber}</div></div>
                  </div>
                  
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mobile-sell-footer">
          <div className="mobile-sell-footer-text">{step === 1 ? '' : ''}</div>
          <div className="mobile-sell-button-row">
            {step === 2 ? (!showFinalSummary ? <button className="mobile-sell-button primary" type="submit" form="payout-form" disabled={payLoading || !bankCode || banksLoading || !accountName}>{payLoading ? 'Saving…' : 'Save Payout & Show Summary'}</button> : <button className="mobile-sell-button primary" onClick={onClose}>Done</button>) : <button className="mobile-sell-button primary" type="submit" form="start-sell-form" disabled={initLoading}>{initLoading ? 'Starting…' : 'Start & Continue to Payout'}</button>}
          </div>
        </div>
      </div>
    </div>
  )
}