// src/sell.tsx - Enhanced version with improved reliability
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
}

type ProgressState = {
  step: 1 | 2
  initData: InitiateSellRes | null
  payData: PayoutRes | null
  formData: {
    token: string
    network: string
    amount: string
    bankCode: string
    bankName: string
    accountNumber: string
    accountName: string
  }
  timestamp: number
}

const TOKENS = ['USDT','USDC','BTC','ETH','SOL','BNB','MATIC','AVAX'] as const
type TokenSym =
  | 'USDT' | 'USDC' | 'BTC' | 'ETH'
  | 'SOL'  | 'BNB'  | 'MATIC' | 'AVAX'

const NETWORKS_BY_TOKEN: Record<TokenSym, Array<{ code: string; label: string }>> = {
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

// Enhanced token checking with async support and error handling
function useTokenStore() {
  const [tokens, setTokens] = useState(() => tokenStore.getTokens())
  const [isWaiting, setIsWaiting] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  
  useEffect(() => {
    if (!tokens.access) {
      setIsWaiting(true)
      setTokenError(null)
      
      tokenStore.waitForTokens(5000).then((newTokens) => {
        setTokens(newTokens)
        setIsWaiting(false)
        if (!newTokens.access) {
          setTokenError('Failed to get authentication token')
        }
      }).catch((err) => {
        console.error('Token wait failed:', err)
        setTokenError('Authentication timeout - please refresh and try again')
        setIsWaiting(false)
      })
    }
  }, [])
  
  // Enhanced polling with error detection
  useEffect(() => {
    if (tokens.access || isWaiting) return
    
    const interval = setInterval(() => {
      try {
        const newTokens = tokenStore.getTokens()
        if (newTokens.access) {
          setTokens(newTokens)
          setTokenError(null)
        }
      } catch (err) {
        console.error('Token polling error:', err)
        setTokenError('Token retrieval error')
      }
    }, 200)
    
    return () => clearInterval(interval)
  }, [tokens.access, isWaiting])
  
  return { ...tokens, isWaiting, tokenError }
}

// Network status detection
function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])
  
  return isOnline
}

// Progress persistence
function saveProgress(data: ProgressState) {
  try {
    const encrypted = btoa(JSON.stringify(data))
    localStorage.setItem('sell_progress', encrypted)
  } catch (err) {
    console.warn('Failed to save progress:', err)
  }
}

function restoreProgress(): ProgressState | null {
  try {
    const data = localStorage.getItem('sell_progress')
    if (!data) return null
    
    const progress = JSON.parse(atob(data)) as ProgressState
    // Only restore if less than 30 minutes old
    if (Date.now() - progress.timestamp < 30 * 60 * 1000) {
      return progress
    }
    localStorage.removeItem('sell_progress')
    return null
  } catch (err) {
    console.warn('Failed to restore progress:', err)
    localStorage.removeItem('sell_progress')
    return null
  }
}

function clearProgress() {
  localStorage.removeItem('sell_progress')
}

function getHeaders(accessToken?: string) {
  const h = new Headers()
  h.set('Content-Type', 'application/json')
  if (accessToken) h.set('Authorization', `Bearer ${accessToken}`)
  return h
}

async function fetchWithAuth(url: string, options: RequestInit = {}, accessToken?: string, timeoutMs: number = 15000): Promise<Response> {
  const headers = getHeaders(accessToken)
  
  // Add timeout using AbortController
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...Object.fromEntries(headers),
        ...Object.fromEntries(new Headers(options.headers || {}))
      }
    })
    
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
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

// Enhanced error display component
function ErrorDisplay({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div role="alert" style={errorBanner}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <strong style={{ color: '#ffaaaa' }}>Error:</strong> {error}
        </div>
        {onRetry && (
          <button 
            style={{ ...btn, padding: '6px 12px', fontSize: 12 }}
            onClick={onRetry}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  )
}

// Debug panel for development
function DebugPanel({ initData, payData, step }: any) {
  // Check if we're in development mode (Vite sets this)
  const isDev = import.meta.env?.DEV || import.meta.env?.MODE === 'development'
  
  if (!isDev) return null
  
  return (
    <details style={{ margin: '16px 0', padding: 12, background: '#1a1a1a', borderRadius: 8 }}>
      <summary style={{ cursor: 'pointer', color: '#888' }}>Debug Info</summary>
      <pre style={{ fontSize: 11, color: '#ccc', marginTop: 8, overflow: 'auto' }}>
        {JSON.stringify({
          step,
          hasInitData: !!initData,
          hasPayData: !!payData,
          initDataKeys: initData ? Object.keys(initData) : [],
          payDataKeys: payData ? Object.keys(payData) : [],
          paymentId: initData?.paymentId,
          payoutStatus: payData?.status,
          timestamp: Date.now()
        }, null, 2)}
      </pre>
    </details>
  )
}

/* ===== Styles ===== */
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 1000 }
const sheetStyle: React.CSSProperties = { width: '100%', maxWidth: 760, background: 'var(--card)', color: 'var(--txt)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow)', overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto 1fr auto', animation: 'scaleIn 120ms ease-out' }
const headerStyle: React.CSSProperties = { padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }
const titleRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 }
const stepperStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)' }
const dot = (active: boolean): React.CSSProperties => ({ width: 8, height: 8, borderRadius: 999, background: active ? 'var(--accent)' : 'var(--border)' })
const bodyStyle: React.CSSProperties = { padding: 18, overflow: 'auto' }
const footerStyle: React.CSSProperties = { padding: 16, display: 'flex', justifyContent: 'space-between', gap: 12, borderTop: '1px solid var(--border)', background: 'linear-gradient(180deg, transparent, rgba(0,0,0,.05))' }
const btn: React.CSSProperties = { appearance: 'none', border: '1px solid var(--border)', background: 'transparent', color: 'var(--txt)', padding: '10px 14px', borderRadius: 10, cursor: 'pointer' }
const btnPrimary: React.CSSProperties = { ...btn, border: 'none', background: 'var(--accent)', color: 'white' }
const btnDangerGhost: React.CSSProperties = { ...btn, borderColor: 'var(--border)', color: 'var(--muted)' }
const gridForm: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
const inputWrap: React.CSSProperties = { display: 'grid', gap: 6 }
const labelText: React.CSSProperties = { fontSize: 12, color: 'var(--muted)' }
const inputBase: React.CSSProperties = { background: '#0f1117', color: 'var(--txt)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', outline: 'none' }
const card: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: 14, background: '#0e0f15', display: 'grid', gap: 10 }
const kvGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
const kStyle: React.CSSProperties = { fontSize: 12, color: 'var(--muted)' }
const vStyle: React.CSSProperties = { fontWeight: 600 }
const mono: React.CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }
const smallMuted: React.CSSProperties = { fontSize: 12, color: 'var(--muted)' }
const row: React.CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap' }
const badge: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '6px 10px', borderRadius: 999, border: '1px solid var(--border)', background: '#0d1210' }
const badgeWarn: React.CSSProperties = { ...badge, background: 'rgba(255, 170, 0, .08)', borderColor: 'rgba(255, 170, 0, .25)' }
const badgeOffline: React.CSSProperties = { ...badge, background: 'rgba(220, 50, 50, .08)', borderColor: 'rgba(220, 50, 50, .25)' }
const errorBanner: React.CSSProperties = { ...card, background: 'rgba(220, 50, 50, .1)', borderColor: 'rgba(220, 50, 50, .25)' }
const successCard: React.CSSProperties = { ...card, background: 'rgba(0, 115, 55, .12)', borderColor: 'rgba(0, 115, 55, .35)' }

export default function SellModal({ open, onClose, onChatEcho }: SellModalProps) {
  // Enhanced token store with error handling
  const { access: accessToken, isWaiting: tokenWaiting, tokenError } = useTokenStore()
  const isOnline = useNetworkStatus()
  
  // Steps: 1 = Start Sell, 2 = Payout. Final summary is a sub-state of step 2.
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1 (Start Sell)
  const [token, setToken] = useState<TokenSym>('USDT')
  const [network, setNetwork] = useState(NETWORKS_BY_TOKEN['USDT'][0].code)
  const [amount, setAmount] = useState<string>('100')
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

  // Countdown starts only AFTER payout is saved (local 15-second window)
  const [summaryExpiresAt, setSummaryExpiresAt] = useState<string | null>(null)
  const { text: countdown, expired } = useCountdown(summaryExpiresAt)

  // Banks
  const [banksLoading, setBanksLoading] = useState(false)
  const [banksError, setBanksError] = useState<string | null>(null)
  const [bankOptions, setBankOptions] = useState<BankOption[]>([])
  const banksFetchedRef = useRef(false)

  // Recovery functionality
  const [isRecovering, setIsRecovering] = useState(false)

  // Reset on open with progress restoration
  useEffect(() => {
    if (!open) return
    
    // Try to restore progress first
    const savedProgress = restoreProgress()
    if (savedProgress) {
      console.log('Restoring saved progress:', savedProgress)
      setStep(savedProgress.step)
      setToken(savedProgress.formData.token as TokenSym)
      setNetwork(savedProgress.formData.network)
      setAmount(savedProgress.formData.amount)
      setBankCode(savedProgress.formData.bankCode)
      setBankName(savedProgress.formData.bankName)
      setAccountNumber(savedProgress.formData.accountNumber)
      setAccountName(savedProgress.formData.accountName)
      setInitData(savedProgress.initData)
      setPayData(savedProgress.payData)
      
      // If we have payData, start countdown
      if (savedProgress.payData) {
        setSummaryExpiresAt(new Date(Date.now() + 15 * 1000).toISOString())
      }
    } else {
      // Fresh start
      setStep(1)
      setToken('USDT')
      setNetwork(NETWORKS_BY_TOKEN['USDT'][0].code)
      setAmount('100')
      setInitData(null)
      setBankName('')
      setBankCode('')
      setAccountNumber('')
      setAccountName('')
      setPayData(null)
      setSummaryExpiresAt(null)
    }
    
    // Reset loading states
    setInitLoading(false)
    setInitError(null)
    setAccountNameLoading(false)
    setAccountNameError(null)
    setPayLoading(false)
    setPayError(null)
    setBanksLoading(false)
    setBanksError(null)
    setBankOptions([])
    banksFetchedRef.current = false
    setIsRecovering(false)
  }, [open])

  // Save progress whenever important state changes
  useEffect(() => {
    if (!open) return
    
    const progress: ProgressState = {
      step,
      initData,
      payData,
      formData: {
        token,
        network,
        amount,
        bankCode,
        bankName,
        accountNumber,
        accountName
      },
      timestamp: Date.now()
    }
    
    // Only save if we have meaningful progress
    if (initData || payData) {
      saveProgress(progress)
    }
  }, [open, step, initData, payData, token, network, amount, bankCode, bankName, accountNumber, accountName])

  // Clear progress on successful completion or close
  useEffect(() => {
    if (!open || (payData && expired)) {
      clearProgress()
    }
  }, [open, payData, expired])

  // Keep network valid
  useEffect(() => {
    const list = NETWORKS_BY_TOKEN[token]
    if (!list.find(n => n.code === network)) setNetwork(list[0].code)
  }, [token, network])

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

  // Fetch banks once when entering Step 2 (wait for auth)
  useEffect(() => {
    if (!open || step !== 2 || banksFetchedRef.current || !accessToken || tokenWaiting) return
    banksFetchedRef.current = true
    
    ;(async () => {
      setBanksLoading(true)
      setBanksError(null)
      try {
        const res = await fetchWithAuth(`${API_BASE}/fetchnaira/naira-accounts`, {
          method: 'GET',
          cache: 'no-store'
        }, accessToken)
        
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)

        const list: BankOption[] = Array.isArray(json?.banks) ? json.banks : []
        const opts: BankOption[] = (list as BankOption[])
          .map((b: BankOption) => ({ name: String(b.name || '').trim(), code: String(b.code || '').trim() }))
          .filter((b: BankOption) => b.name.length > 0 && b.code.length > 0)
          .sort((a: BankOption, b: BankOption) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

        setBankOptions(opts)
        if (opts.length && !bankCode) {
          setBankCode(opts[0].code)
          setBankName(opts[0].name)
        }
      } catch (e: any) {
        setBanksError(e?.message || 'Failed to load banks')
        setBankOptions([])
        if (!bankCode) {
          setBankCode('')
          setBankName('')
        }
      } finally {
        setBanksLoading(false)
      }
    })()
  }, [open, step, accessToken, tokenWaiting, bankCode])

  // Resolve account name when account number is 10+ digits (wait for auth)
  useEffect(() => {
    if (!open || step !== 2 || !bankCode || !accountNumber || !accessToken || tokenWaiting) return
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
        const res = await fetchWithAuth(
          `${API_BASE}/accountname/resolve?sortCode=${encodeURIComponent(bankCode)}&accountNumber=${encodeURIComponent(accountNumber)}`,
          { method: 'GET' },
          accessToken
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
        setAccountNameError(err.message || 'Failed to resolve account name')
        setAccountName('')
      } finally {
        setAccountNameLoading(false)
      }
    }, 500) // Debounce for 500ms

    return () => clearTimeout(timeoutId)
  }, [open, step, bankCode, accountNumber, accessToken, tokenWaiting])

  // Enhanced initiate function with retry logic
  async function submitInitiate(e: React.FormEvent) {
    e.preventDefault()
    setInitError(null)
    
    if (!isOnline) {
      setInitError('No internet connection. Please check your network.')
      return
    }
    
    if (!amount || isNaN(+amount) || +amount <= 0) {
      setInitError('Enter a valid amount')
      return
    }
    
    if (!accessToken) {
      setInitError('Please sign in first')
      return
    }
    
    setInitLoading(true)
    
    const maxRetries = 3
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Initiate attempt ${attempt}/${maxRetries}`, {
          token,
          network,
          amount: +amount
        })
        
        const res = await fetchWithAuth(`${API_BASE}/sell/initiate`, {
          method: 'POST',
          body: JSON.stringify({ token, network, sellAmount: +amount }),
        }, accessToken)
        
        if (!res.ok) {
          const errorText = await res.text()
          console.error('Initiate API error:', {
            status: res.status,
            statusText: res.statusText,
            body: errorText
          })
          throw new Error(`Server error (${res.status}): ${errorText}`)
        }
        
        const data: InitiateSellRes = await res.json()
        
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid response format from server')
        }
        
        if (!data.success) {
          throw new Error(data.message || 'Server reported failure')
        }
        
        // Validate required fields
        if (!data.paymentId || !data.reference || !data.deposit || !data.quote) {
          console.error('Incomplete initiate response:', data)
          throw new Error('Incomplete response from server')
        }
        
        console.log('Initiate successful:', {
          paymentId: data.paymentId,
          reference: data.reference
        })
        
        setInitData(data)
        setStep(2)
        return
        
      } catch (err: any) {
        lastError = err
        console.error(`Initiate attempt ${attempt} failed:`, err)
        
        // Don't retry for validation/auth errors
        if (err.message?.includes('Enter a valid') || 
            err.message?.includes('sign in') ||
            err.message?.includes('400') ||
            err.message?.includes('401') ||
            err.message?.includes('403')) {
          break
        }
        
        // Wait before retry
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000
          console.log(`Retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    const errorMsg = lastError?.message || 'Failed to initiate sell'
    setInitError(`${errorMsg}${maxRetries > 1 ? ` (tried ${maxRetries} times)` : ''}`)
    setInitLoading(false)
  }

  // Enhanced payout function with comprehensive error handling and retry
  async function submitPayout(e: React.FormEvent) {
    e.preventDefault()
    setPayError(null)
    
    if (!isOnline) {
      setPayError('No internet connection. Please check your network.')
      return
    }
    
    // Enhanced validation
    if (!bankName || !bankCode || !accountNumber || !accountName) {
      setPayError('Fill in all bank fields')
      return
    }
    if (!initData?.paymentId) {
      setPayError('Missing paymentId — restart the sell flow')
      return
    }
    
    if (!accessToken) {
      setPayError('Please sign in first')
      return
    }
    
    setPayLoading(true)
    
    // Retry mechanism for network issues
    const maxRetries = 3
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Payout attempt ${attempt}/${maxRetries}`, {
          paymentId: initData.paymentId,
          bankCode,
          accountNumber: accountNumber.slice(0, 4) + '****' // Log safely
        })
        
        const res = await fetchWithAuth(`${API_BASE}/sell/payout`, {
          method: 'POST',
          body: JSON.stringify({
            paymentId: initData.paymentId,
            bankName,
            bankCode,
            accountNumber,
            accountName,
          }),
        }, accessToken)
        
        // Enhanced response validation
        if (!res.ok) {
          const errorText = await res.text()
          console.error('Payout API error:', {
            status: res.status,
            statusText: res.statusText,
            body: errorText
          })
          throw new Error(`Server error (${res.status}): ${errorText}`)
        }
        
        const data: PayoutRes = await res.json()
        
        console.log('🔍 Raw payout response:', JSON.stringify(data, null, 2))
        
        // Basic response validation
        if (!data || typeof data !== 'object') {
          console.error('❌ Invalid response format:', data)
          throw new Error('Invalid response format from server')
        }
        
        if (!data.success) {
          console.error('❌ Server reported failure:', data.message)
          throw new Error(data.message || 'Server reported failure')
        }
        
        // Log what we received
        console.log('✅ Payout response received:', {
          hasPaymentId: !!data.paymentId,
          hasStatus: !!data.status,
          hasPayout: !!data.payout,
          paymentId: data.paymentId,
          status: data.status,
          payout: data.payout
        })
        
        // More lenient validation - just check if we have the essential data
        if (!data.paymentId) {
          console.error('❌ Missing paymentId in response')
          throw new Error('Missing paymentId in response')
        }
        
        if (!data.payout || typeof data.payout !== 'object') {
          console.error('❌ Missing or invalid payout object in response')
          throw new Error('Missing payout details in response')
        }
        
        console.log('✅ Payout validation passed, setting payData...')
        
        // Success! Set the data and trigger summary
        setPayData(data)
        
        console.log('✅ PayData set, building chat recap...')
        
        // Send to chat with error handling
        try {
          const recap = buildPayoutRecap(initData, data)
          console.log('✅ Chat recap built:', recap.slice(0, 100) + '...')
          onChatEcho?.(recap)
          console.log('✅ Chat echo sent successfully')
        } catch (chatError) {
          console.error('⚠️ Chat echo failed:', chatError)
          // Don't fail the whole flow for chat issues
        }
        
        console.log('✅ Starting countdown timer...')
        
        // Start countdown timer
        setSummaryExpiresAt(new Date(Date.now() + 15 * 1000).toISOString())
        setPayLoading(false)
        
        console.log('✅ Payout flow completed successfully!')
        
        // Success - break out of retry loop
        return
        
      } catch (err: any) {
        lastError = err
        console.error(`Payout attempt ${attempt} failed:`, err)
        
        // Don't retry for validation errors or auth errors
        if (err.message?.includes('Fill in all') || 
            err.message?.includes('sign in') ||
            err.message?.includes('400') ||
            err.message?.includes('401') ||
            err.message?.includes('403')) {
          break
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000 // 1s, 2s, 4s
          console.log(`Retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    // All retries failed
    const errorMsg = lastError?.message || 'Failed to save payout details'
    console.error('All payout attempts failed:', lastError)
    setPayError(`${errorMsg}${maxRetries > 1 ? ` (tried ${maxRetries} times)` : ''}`)
    setPayLoading(false)
  }

  // Recovery function for stuck transactions
  async function recoverTransaction() {
    if (!initData?.paymentId || !accessToken) return
    
    setIsRecovering(true)
    setPayError(null)
    
    try {
      console.log('Attempting transaction recovery for:', initData.paymentId)
      
      const res = await fetchWithAuth(`${API_BASE}/sell/status/${initData.paymentId}`, {
        method: 'GET'
      }, accessToken)
      
      if (!res.ok) {
        throw new Error(`Failed to recover transaction: HTTP ${res.status}`)
      }
      
      const data = await res.json()
      
      if (data.success && data.payout) {
        console.log('Transaction recovered successfully')
        setPayData(data)
        setSummaryExpiresAt(new Date(Date.now() + 15 * 1000).toISOString())
        
        try {
          onChatEcho?.(buildPayoutRecap(initData, data))
        } catch (chatError) {
          console.warn('Chat echo failed during recovery:', chatError)
        }
      } else {
        throw new Error('Transaction not found or incomplete')
      }
    } catch (err: any) {
      console.error('Recovery failed:', err)
      setPayError(`Recovery failed: ${err.message}`)
    } finally {
      setIsRecovering(false)
    }
  }

  // Auto-close when the countdown expires on the final summary
  const showFinalSummary = !!payData
  useEffect(() => {
    if (!open) return
    if (showFinalSummary && expired) {
      onClose()
    }
  }, [open, showFinalSummary, expired, onClose])

  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  function copyToClipboard(text: string, key: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1200)
    }).catch(() => {})
  }

  if (!open) return null

  // Show loading state while waiting for tokens
  if (tokenWaiting || (!accessToken && !tokenError)) {
    return createPortal(
      <div style={overlayStyle} role="dialog" aria-modal="true">
        <div style={{...sheetStyle, padding: 40, textAlign: 'center' as const, minHeight: 200, placeItems: 'center'}}>
          <div style={{marginBottom: 16}}>
            <div style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTop: '2px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
          </div>
          <div style={{color: 'var(--muted)'}}>
            {tokenWaiting ? 'Waiting for authentication...' : 'Please sign in to continue'}
          </div>
          {!isOnline && (
            <div style={{...badgeOffline, marginTop: 12}}>
              📵 Offline
            </div>
          )}
          {!tokenWaiting && (
            <button style={{...btnPrimary, marginTop: 16}} onClick={onClose}>Close</button>
          )}
        </div>
        <style>
          {`@keyframes spin{from{transform:rotate(0deg)} to{transform:rotate(360deg)}}`}
        </style>
      </div>,
      document.body
    )
  }

  // Show token error
  if (tokenError && !accessToken) {
    return createPortal(
      <div style={overlayStyle} role="dialog" aria-modal="true">
        <div style={{...sheetStyle, padding: 40, textAlign: 'center' as const, minHeight: 200}}>
          <div style={{color: '#ffaaaa', marginBottom: 16, fontSize: 18}}>
            🔐 Authentication Error
          </div>
          <div style={{color: 'var(--muted)', marginBottom: 20}}>
            {tokenError}
          </div>
          <div style={{display: 'flex', gap: 12, justifyContent: 'center'}}>
            <button style={btn} onClick={() => window.location.reload()}>
              Refresh Page
            </button>
            <button style={btnPrimary} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  const headerTitle =
    step === 1 ? 'Start a Sell'
    : (!payData ? 'Payout Details' : 'Transaction Summary')

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
                <span style={dot(step === 1)}></span> Step 1 — Start
                <span style={{ opacity: .4, padding: '0 6px' }}>•</span>
                <span style={dot(step === 2)}></span> Step 2 — Payout
                {/* Status indicators */}
                {!isOnline && <span style={{...badgeOffline, marginLeft: 8}}>📵 Offline</span>}
              </div>
            </div>
          </div>
          <button type="button" aria-label="Close" style={btnDangerGhost} onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div style={bodyStyle}>
          {/* STEP 1 — Start a Sell */}
          {step === 1 && (
            <div style={{ display: 'grid', gap: 14 }}>
              <p style={{ margin: 0, color: 'var(--muted)' }}>
                Choose token, network, and amount. We'll capture payout next.
              </p>

              {!!initError && (
                <ErrorDisplay 
                  error={initError} 
                  onRetry={() => setInitError(null)}
                />
              )}

              <form onSubmit={submitInitiate} style={gridForm}>
                <label style={inputWrap}>
                  <span style={labelText}>Token</span>
                  <select
                    ref={firstInputRef as any}
                    style={inputBase}
                    value={token}
                    onChange={e => setToken(e.target.value as TokenSym)}
                    disabled={initLoading}
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
                    disabled={initLoading}
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
                    disabled={initLoading}
                  />
                </label>

                <div style={{ gridColumn: '1 / span 2', display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    style={btnPrimary} 
                    disabled={initLoading || !isOnline}
                  >
                    {initLoading ? (
                      <>
                        <div style={{ width: 12, height: 12, border: '2px solid white', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: 8, display: 'inline-block' }}></div>
                        Starting…
                      </>
                    ) : (
                      'Start & Continue to Payout'
                    )}
                  </button>
                </div>
              </form>

              <DebugPanel initData={initData} payData={payData} step={step} />
            </div>
          )}

          {/* STEP 2 — Payout (then Summary with countdown) */}
          {step === 2 && (
            <div style={{ display: 'grid', gap: 14 }}>
              {!initData && (
                <div role="alert" style={errorBanner}>
                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                    <span>Missing sell reference — please restart.</span>
                    <button style={{...btn, padding: '6px 12px', fontSize: 12}} onClick={() => setStep(1)}>
                      Restart
                    </button>
                  </div>
                </div>
              )}

              {initData && !showFinalSummary && (
                <>
                  <div style={card}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Sell Summary</h3>
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
                    <ErrorDisplay 
                      error={payError} 
                      onRetry={() => {
                        setPayError(null)
                        if (initData?.paymentId) {
                          recoverTransaction()
                        }
                      }}
                    />
                  )}

                  <form onSubmit={submitPayout} style={gridForm}>
                    <label style={inputWrap}>
                      <span style={labelText}>Bank</span>
                      <select
                        ref={firstInputRef as any}
                        style={inputBase}
                        value={bankCode}
                        disabled={banksLoading || bankOptions.length === 0 || payLoading}
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
                        disabled={payLoading}
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
                          'Enter account number'
                        }
                      </div>
                    </label>

                    <div style={{ gridColumn: '1 / span 2', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                      {isRecovering && (
                        <button type="button" style={btn} disabled>
                          <div style={{ width: 12, height: 12, border: '2px solid var(--border)', borderTop: '2px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: 8, display: 'inline-block' }}></div>
                          Recovering...
                        </button>
                      )}
                      <button
                        style={btnPrimary}
                        disabled={payLoading || !bankCode || banksLoading || !accountName || !isOnline || isRecovering}
                      >
                        {payLoading ? (
                          <>
                            <div style={{ width: 12, height: 12, border: '2px solid white', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: 8, display: 'inline-block' }}></div>
                            Saving…
                          </>
                        ) : (
                          'Save Payout & Show Summary'
                        )}
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* FINAL SUMMARY (countdown starts here) */}
              {initData && showFinalSummary && payData && (
                <div style={successCard}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Transaction Summary</h3>
                    <div style={badge}>
                      ⏱ {expired ? 'Expired' : countdown} <span style={{ opacity: .6 }}>of 00:15</span>
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
                      <div>
                        <div style={vStyle}>
                          {prettyNgn(initData.quote.receiveAmount || 0)} ({initData.quote.receiveCurrency})
                        </div>
                        <div style={{ ...smallMuted, marginTop: 4 }}>
                          Transaction fee (fixed): <strong>70&nbsp;NGN</strong>
                        </div>
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

              <DebugPanel initData={initData} payData={payData} step={step} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <div style={smallMuted}>
            {step === 1
              ? 'We\'ll capture your payout next.'
              : (showFinalSummary
                  ? 'Copy the deposit details and send the exact amount within the window.'
                  : 'Ensure your bank details match your account name.')}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {step === 2 ? (
              !showFinalSummary ? (
                <button style={btn} onClick={() => setStep(1)} disabled={payLoading}>← Back</button>
              ) : (
                <button style={btn} onClick={onClose}>Close</button>
              )
            ) : (
              <button style={btn} onClick={onClose}>Cancel</button>
            )}
          </div>
        </div>
      </div>

      {/* Animation keyframes */}
      <style>
        {`@keyframes scaleIn{from{transform:translateY(8px) scale(.98); opacity:0} to{transform:none; opacity:1}} @keyframes spin{from{transform:rotate(0deg)} to{transform:rotate(360deg)}}`}
      </style>
    </div>,
    document.body
  )
}