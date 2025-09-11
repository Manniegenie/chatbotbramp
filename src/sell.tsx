// src/sell.tsx
import React, { useEffect, useReducer, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { tokenStore } from './lib/secureStore'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'

/* Types, constants, helpers — unchanged except for small logs where helpful */
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
    expiresAt?: string
  }
  payout?: {
    bankName: string
    bankCode: string
    accountNumber: string
    accountName: string
    capturedAt?: string
  }
  deposit?: {
    address?: string
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
  console.log('🔑 Token check:', {
    hasAccess: !!access,
    accessLength: access?.length || 0,
    tokenStore: typeof tokenStore,
    coldStart: performance.getEntriesByType('navigation').length === 0 ||
      (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type === 'reload'
  })
  const h = new Headers()
  h.set('Content-Type', 'application/json')
  if (access) h.set('Authorization', `Bearer ${access}`)
  return h
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, ms = 15000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(id)
    return res
  } catch (err) {
    clearTimeout(id)
    throw err
  }
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

function buildPayoutRecap(init: InitiateSellRes | null, p: PayoutRes) {
  const t = (init?.deposit?.token || init?.token || '').toUpperCase()
  const netLabel = toNetworkLabel(t, init?.deposit?.network || init?.network || '')
  const payAmount = init?.deposit?.amount ?? init?.sellAmount
  const recv = init?.quote?.receiveAmount ?? p.quote?.receiveAmount
  const rate = init?.quote?.rate ?? p.quote?.rate

  return [
    `Payout details saved 🏦`,
    `Bank: ${p.payout?.bankName ?? '—'}`,
    `Account: ${p.payout?.accountName ?? '—'} — ${p.payout?.accountNumber ?? '—'}`,
    '',
    `Recap: pay **${prettyAmount(Number(payAmount || 0))} ${t}** on **${netLabel}**.`,
    `You'll receive: **${prettyNgn(Number(recv || 0))}** at **${prettyAmount(Number(rate || 0))} NGN/${t}**.`,
    `⚠️ Remember: pay the **exact amount** shown for smooth processing.`,
  ].join('\n')
}

/* Countdown hook — returns expired=false if there's no expiry yet */
function useCountdown(expiryIso?: string | null) {
  const [msLeft, setMsLeft] = useState<number>(() => expiryIso ? Math.max(0, new Date(expiryIso).getTime() - Date.now()) : 0)
  useEffect(() => {
    if (!expiryIso) {
      setMsLeft(0)
      return
    }
    const update = () => setMsLeft(Math.max(0, new Date(expiryIso).getTime() - Date.now()))
    update()
    const t = setInterval(update, 250)
    return () => clearInterval(t)
  }, [expiryIso])
  const mm = Math.floor(msLeft / 60000)
  const ss = Math.floor((msLeft % 60000) / 1000)
  const expired = expiryIso ? msLeft <= 0 : false
  return { msLeft, text: `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, expired }
}

/* Styles — copied from your original file (kept identical) */
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
const errorBanner: React.CSSProperties = { ...card, background: 'rgba(220, 50, 50, .1)', borderColor: 'rgba(220, 50, 50, .25)' }
const successCard: React.CSSProperties = { ...card, background: 'rgba(0, 115, 55, .12)', borderColor: 'rgba(0, 115, 55, .35)' }

/* Reducer + state (same atomic PAYOUT_SUCCESS) */

type Flow = 'idle' | 'initiated' | 'complete'

type State = {
  flow: Flow
  token: TokenSym
  network: string
  amount: string

  initLoading: boolean
  initError: string | null
  initData: InitiateSellRes | null

  payLoading: boolean
  payError: string | null
  payData: PayoutRes | null

  summaryExpiresAt: string | null

  banksLoading: boolean
  banksError: string | null
  bankOptions: BankOption[]
  bankCode: string
  bankName: string
  accountNumber: string
  accountName: string
  accountNameLoading: boolean
  accountNameError: string | null
}

const initialState: State = {
  flow: 'idle',
  token: 'USDT',
  network: NETWORKS_BY_TOKEN['USDT'][0].code,
  amount: '100',

  initLoading: false,
  initError: null,
  initData: null,

  payLoading: false,
  payError: null,
  payData: null,

  summaryExpiresAt: null,

  banksLoading: false,
  banksError: null,
  bankOptions: [],
  bankCode: '',
  bankName: '',
  accountNumber: '',
  accountName: '',
  accountNameLoading: false,
  accountNameError: null,
}

type Action =
  | { type: 'RESET' }
  | { type: 'SET_FIELD'; key: keyof State; value: any }
  | { type: 'INIT_START' }
  | { type: 'INIT_SUCCESS'; payload: InitiateSellRes }
  | { type: 'INIT_FAIL'; error: string }
  | { type: 'PAYOUT_START' }
  | { type: 'PAYOUT_SUCCESS'; payload: PayoutRes; expiryIso: string }
  | { type: 'PAYOUT_FAIL'; error: string }
  | { type: 'SET_BANKS'; banks: BankOption[] }
  | { type: 'SET_ACCOUNT_NAME'; name?: string; error?: string | null }

function reducer(s: State, action: Action): State {
  switch (action.type) {
    case 'RESET': return { ...initialState }
    case 'SET_FIELD': return { ...s, [action.key]: action.value }
    case 'INIT_START': return { ...s, initLoading: true, initError: null }
    case 'INIT_SUCCESS': return { ...s, initLoading: false, initData: action.payload, flow: 'initiated' }
    case 'INIT_FAIL': return { ...s, initLoading: false, initError: action.error }
    case 'PAYOUT_START': return { ...s, payLoading: true, payError: null }
    case 'PAYOUT_SUCCESS':
      return { ...s, payLoading: false, payData: action.payload, summaryExpiresAt: action.expiryIso, flow: 'complete' }
    case 'PAYOUT_FAIL': return { ...s, payLoading: false, payError: action.error }
    case 'SET_BANKS': {
      const first = action.banks[0] ?? { name: '', code: '' }
      return { ...s, bankOptions: action.banks, bankCode: first.code, bankName: first.name, banksLoading: false, banksError: null }
    }
    case 'SET_ACCOUNT_NAME':
      return { ...s, accountName: action.name ?? '', accountNameError: action.error ?? null, accountNameLoading: false }
    default: return s
  }
}

/* Component */
export default function SellModal({ open, onClose, onChatEcho }: SellModalProps) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const banksFetchedRef = useRef(false)
  const firstInputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const { text: countdown, expired } = useCountdown(state.summaryExpiresAt)

  // Reset on open
  useEffect(() => {
    if (!open) return
    dispatch({ type: 'RESET' })
    banksFetchedRef.current = false
    console.log('Modal opened — state reset')
  }, [open])

  // Keep network valid
  useEffect(() => {
    const list = NETWORKS_BY_TOKEN[state.token]
    if (!list.find(n => n.code === state.network)) {
      dispatch({ type: 'SET_FIELD', key: 'network', value: list[0].code })
    }
  }, [state.token])

  // Esc to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Autofocus per flow
  useEffect(() => { firstInputRef.current?.focus() }, [state.flow])

  // Fetch banks once when entering 'initiated'
  useEffect(() => {
    if (!open || state.flow !== 'initiated' || banksFetchedRef.current) return
    banksFetchedRef.current = true
    ;(async () => {
      dispatch({ type: 'SET_FIELD', key: 'banksLoading', value: true })
      dispatch({ type: 'SET_FIELD', key: 'banksError', value: null })
      try {
        const res = await fetchWithTimeout(`${API_BASE}/fetchnaira/naira-accounts`, { method: 'GET', headers: getHeaders(), cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
        const list: BankOption[] = Array.isArray(json?.banks) ? json.banks : []
        const opts: BankOption[] = (list as BankOption[])
          .map((b: any) => ({ name: String(b.name || '').trim(), code: String(b.code || '').trim() }))
          .filter((b: BankOption) => b.name.length > 0 && b.code.length > 0)
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        dispatch({ type: 'SET_BANKS', banks: opts })
      } catch (e: any) {
        dispatch({ type: 'SET_FIELD', key: 'banksLoading', value: false })
        dispatch({ type: 'SET_FIELD', key: 'banksError', value: e?.message || 'Failed to load banks' })
        dispatch({ type: 'SET_FIELD', key: 'bankOptions', value: [] })
        dispatch({ type: 'SET_FIELD', key: 'bankCode', value: '' })
        dispatch({ type: 'SET_FIELD', key: 'bankName', value: '' })
      }
    })()
  }, [open, state.flow])

  // Resolve account name (debounced)
  useEffect(() => {
    if (!open || state.flow !== 'initiated' || !state.bankCode || !state.accountNumber) return
    if (state.accountNumber.length < 10) {
      dispatch({ type: 'SET_ACCOUNT_NAME', name: '', error: null })
      return
    }

    const timeoutId = setTimeout(async () => {
      dispatch({ type: 'SET_FIELD', key: 'accountNameLoading', value: true })
      dispatch({ type: 'SET_FIELD', key: 'accountNameError', value: null })
      dispatch({ type: 'SET_FIELD', key: 'accountName', value: '' })
      try {
        const res = await fetchWithTimeout(
          `${API_BASE}/accountname/resolve?sortCode=${encodeURIComponent(state.bankCode)}&accountNumber=${encodeURIComponent(state.accountNumber)}`,
          { method: 'GET', headers: getHeaders() }
        )
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data?.message || `HTTP ${res.status}`)
        if (data.data?.accountName) {
          dispatch({ type: 'SET_ACCOUNT_NAME', name: data.data.accountName, error: null })
        } else {
          throw new Error('Account name not found')
        }
      } catch (err: any) {
        dispatch({ type: 'SET_ACCOUNT_NAME', name: '', error: err?.message || 'Failed to resolve account name' })
      } finally {
        // accountNameLoading cleared by SET_ACCOUNT_NAME
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [open, state.flow, state.bankCode, state.accountNumber])

  // AUTHORITATIVE final-summary check — showFinalSummary is true when flow === 'complete'
  const showFinalSummary = state.flow === 'complete'

  // Auto-close when the countdown expires on the final summary
  useEffect(() => {
    if (!open) return
    if (!state.summaryExpiresAt) return
    if (showFinalSummary && expired) {
      console.log('Auto-closing modal because countdown expired', { summaryExpiresAt: state.summaryExpiresAt, expired })
      onClose()
    }
  }, [open, showFinalSummary, expired, onClose, state.summaryExpiresAt])

  // Log whenever flow becomes 'complete' so you can see actual state after reducer update
  useEffect(() => {
    if (state.flow === 'complete') {
      console.log('FLOW -> complete. state snapshot:', {
        initData: !!state.initData,
        payData: !!state.payData,
        summaryExpiresAt: state.summaryExpiresAt,
        payLoading: state.payLoading
      })
    }
  }, [state.flow])

  // overlay click handler: ignore overlay clicks while final summary active & countdown not expired
  const onOverlayClick = () => {
    if (state.flow === 'complete' && state.summaryExpiresAt && !expired) {
      console.log('Overlay click ignored because final summary countdown is active', { summaryExpiresAt: state.summaryExpiresAt, expired })
      return
    }
    onClose()
  }

  // Clipboard helper
  function copyToClipboard(text: string, key: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1200)
    }).catch(() => {})
  }

  /* Handlers: submitInitiate & submitPayout (same as before, with atomic dispatch) */

  async function submitInitiate(e: React.FormEvent) {
    e.preventDefault()
    dispatch({ type: 'INIT_START' })
    dispatch({ type: 'SET_FIELD', key: 'initError', value: null })
    if (!state.amount || isNaN(+state.amount) || +state.amount <= 0) {
      dispatch({ type: 'INIT_FAIL', error: 'Enter a valid amount' })
      return
    }
    try {
      const res = await fetchWithTimeout(`${API_BASE}/sell/initiate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ token: state.token, network: state.network, sellAmount: +state.amount }),
      })
      const data: InitiateSellRes = await res.json()
      if (!res.ok || !data.success) throw new Error(data?.message || `HTTP ${res.status}`)
      dispatch({ type: 'INIT_SUCCESS', payload: data })
    } catch (err: any) {
      dispatch({ type: 'INIT_FAIL', error: err.message || 'Failed to initiate sell' })
    }
  }

  async function submitPayout(e: React.FormEvent) {
    e.preventDefault()
    dispatch({ type: 'PAYOUT_START' })
    dispatch({ type: 'SET_FIELD', key: 'payError', value: null })
    if (!state.bankName || !state.bankCode || !state.accountNumber || !state.accountName) {
      dispatch({ type: 'PAYOUT_FAIL', error: 'Fill in all bank fields' })
      return
    }
    if (!state.initData?.paymentId) {
      dispatch({ type: 'PAYOUT_FAIL', error: 'Missing paymentId — restart the sell flow' })
      return
    }
    try {
      console.log('🚀 Starting payout call:', {
        paymentId: state.initData.paymentId,
        bankCode: state.bankCode,
        accountNumber: state.accountNumber.slice(0, 4) + '****'
      })

      const res = await fetchWithTimeout(`${API_BASE}/sell/payout`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          paymentId: state.initData.paymentId,
          bankName: state.bankName,
          bankCode: state.bankCode,
          accountNumber: state.accountNumber,
          accountName: state.accountName,
        }),
      })

      console.log('📡 Payout response received:', {
        status: res.status,
        ok: res.ok,
        headers: Object.fromEntries(res.headers.entries())
      })

      const responseText = await res.text()
      console.log('📄 Raw response text:', responseText)

      let data: PayoutRes
      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error('❌ JSON parse failed:', parseError)
        throw new Error('Invalid JSON response from server')
      }

      console.log('📦 Parsed response data:', data)

      if (!res.ok) {
        console.error('❌ HTTP error:', res.status, data)
        throw new Error(data?.message || `HTTP ${res.status}`)
      }

      if (!data.success) {
        console.error('❌ Server reported failure:', data.message)
        throw new Error(data.message || 'Server reported failure')
      }

      if (!data.paymentId) {
        console.error('❌ Missing paymentId in response')
        throw new Error('Missing paymentId in response')
      }

      if (!data.payout) {
        console.error('❌ Missing payout object in response')
        throw new Error('Missing payout details in response')
      }

      console.log('✅ Payout validation passed, preparing to show summary...')

      const expiryTime = new Date(Date.now() + 10 * 60 * 1000).toISOString()
      console.log('⏰ Setting countdown expiry to:', expiryTime)

      // Atomic transition: set payData + expiry + flow
      dispatch({ type: 'PAYOUT_SUCCESS', payload: data, expiryIso: expiryTime })

      console.log('🎉 Payout flow completed successfully (dispatched PAYOUT_SUCCESS)')

      // chat recap
      try {
        const recap = buildPayoutRecap(state.initData, data)
        console.log('💬 Sending chat recap...')
        onChatEcho?.(recap)
        console.log('✅ Chat recap sent')
      } catch (chatError) {
        console.warn('⚠️ Chat echo failed:', chatError)
      }

      // stabilization tick
      setTimeout(() => {
        console.log('💥 Post-payout UI stabilization tick')
        dispatch({ type: 'SET_FIELD', key: 'payLoading', value: false })
      }, 100)

    } catch (err: any) {
      console.error('💥 Payout failed:', err)
      dispatch({ type: 'PAYOUT_FAIL', error: err.message || 'Failed to save payout details' })
    } finally {
      dispatch({ type: 'SET_FIELD', key: 'payLoading', value: false })
      console.log('🏁 Payout loading state cleared')
    }
  }

  if (!open) return null

  const headerTitle =
    state.flow === 'idle' ? 'Start a Sell'
      : (state.flow === 'initiated' ? 'Payout Details' : 'Transaction Summary')

  return createPortal(
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="sell-title" onClick={onOverlayClick}>
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
                <span style={dot(state.flow === 'idle')}></span> Step 1 — Start
                <span style={{ opacity: .4, padding: '0 6px' }}>•</span>
                <span style={dot(state.flow !== 'idle')}></span> Step 2 — Payout
              </div>
            </div>
          </div>
          <button type="button" aria-label="Close" style={btnDangerGhost} onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div style={bodyStyle}>
          {/* Always-visible debug panel — shows the important values so you can see exactly what's missing */}
          <div style={{ ...card, background: '#111', marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: '#ccc' }}>
              <div><strong>Diagnostics</strong></div>
              <div>flow: {state.flow}</div>
              <div>initData: {state.initData ? 'yes' : 'no'}</div>
              <div>payData: {state.payData ? 'yes' : 'no'}</div>
              <div>summaryExpiresAt: {state.summaryExpiresAt ?? 'null'}</div>
              <div>expired: {expired ? 'true' : 'false'}</div>
              <div>initLoading: {String(state.initLoading)}</div>
              <div>payLoading: {String(state.payLoading)}</div>
            </div>
          </div>

          {/* STEP 1 — Start a Sell */}
          {state.flow === 'idle' && (
            <div style={{ display: 'grid', gap: 14 }}>
              <p style={{ margin: 0, color: 'var(--muted)' }}>
                Choose token, network, and amount. We'll capture payout next.
              </p>

              {!!state.initError && (
                <div role="alert" style={errorBanner}>
                  <strong style={{ color: '#ffaaaa' }}>Error:</strong> {state.initError}
                </div>
              )}

              <form onSubmit={submitInitiate} style={gridForm}>
                <label style={inputWrap}>
                  <span style={labelText}>Token</span>
                  <select
                    ref={firstInputRef as any}
                    style={inputBase}
                    value={state.token}
                    onChange={e => dispatch({ type: 'SET_FIELD', key: 'token', value: e.target.value })}
                  >
                    {TOKENS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>

                <label style={inputWrap}>
                  <span style={labelText}>Network</span>
                  <select
                    style={inputBase}
                    value={state.network}
                    onChange={e => dispatch({ type: 'SET_FIELD', key: 'network', value: e.target.value })}
                  >
                    {NETWORKS_BY_TOKEN[state.token].map(n => (
                      <option key={n.code} value={n.code}>{n.label}</option>
                    ))}
                  </select>
                </label>

                <label style={{ ...inputWrap, gridColumn: '1 / span 2' }}>
                  <span style={labelText}>Amount ({state.token})</span>
                  <input
                    style={inputBase}
                    inputMode="decimal"
                    placeholder="e.g. 100"
                    value={state.amount}
                    onChange={e => dispatch({ type: 'SET_FIELD', key: 'amount', value: e.target.value })}
                  />
                </label>

                <div style={{ gridColumn: '1 / span 2', display: 'flex', justifyContent: 'flex-end' }}>
                  <button style={btnPrimary} disabled={state.initLoading}>
                    {state.initLoading ? 'Starting…' : 'Start & Continue to Payout'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 2 — Payout (then Summary with countdown) */}
          {state.flow !== 'idle' && (
            <div style={{ display: 'grid', gap: 14 }}>
              {!state.initData && (
                <div role="alert" style={errorBanner}>
                  Missing sell reference — please restart.
                </div>
              )}

              {state.initData && state.flow === 'initiated' && (
                <>
                  <div style={card}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Sell Summary</h3>
                    <div style={kvGrid}>
                      <div>
                        <div style={kStyle}>Payment ID</div>
                        <div style={{ ...vStyle, ...mono }}>{state.initData?.paymentId}</div>
                      </div>
                      <div>
                        <div style={kStyle}>Reference</div>
                        <div style={{ ...vStyle, ...mono }}>{state.initData?.reference}</div>
                      </div>
                      <div>
                        <div style={kStyle}>You Receive</div>
                        <div style={vStyle}>
                          {prettyNgn(state.initData?.quote.receiveAmount ?? 0)} ({state.initData?.quote.receiveCurrency})
                        </div>
                      </div>
                      <div>
                        <div style={kStyle}>Rate</div>
                        <div style={vStyle}>{prettyAmount(state.initData?.quote.rate ?? 0)} NGN/{state.initData?.deposit.token}</div>
                      </div>
                    </div>
                  </div>

                  {!!state.payError && (
                    <div role="alert" style={errorBanner}>
                      <strong style={{ color: '#ffaaaa' }}>Error:</strong> {state.payError}
                    </div>
                  )}

                  <form onSubmit={submitPayout} style={gridForm}>
                    <label style={inputWrap}>
                      <span style={labelText}>Bank</span>
                      <select
                        ref={firstInputRef as any}
                        style={inputBase}
                        value={state.bankCode}
                        disabled={state.banksLoading || state.bankOptions.length === 0}
                        onChange={e => {
                          const code = e.target.value
                          const hit = state.bankOptions.find((b: BankOption) => b.code === code)
                          if (hit) {
                            dispatch({ type: 'SET_FIELD', key: 'bankCode', value: hit.code })
                            dispatch({ type: 'SET_FIELD', key: 'bankName', value: hit.name })
                          } else {
                            dispatch({ type: 'SET_FIELD', key: 'bankCode', value: code })
                          }
                        }}
                      >
                        {state.bankOptions.length === 0 ? (
                          <option value="">{state.banksLoading ? 'Loading…' : (state.banksError || 'No banks')}</option>
                        ) : (
                          state.bankOptions.map((b: BankOption) => (
                            <option key={b.code} value={b.code}>{b.name}</option>
                          ))
                        )}
                      </select>
                    </label>

                    <label style={inputWrap}>
                      <span style={labelText}>Account Number</span>
                      <input
                        style={inputBase}
                        value={state.accountNumber}
                        onChange={e => dispatch({ type: 'SET_FIELD', key: 'accountNumber', value: e.target.value })}
                        placeholder="e.g. 0123456789"
                      />
                    </label>

                    <label style={{ ...inputWrap, gridColumn: '1 / span 2' }}>
                      <span style={labelText}>Account Name</span>
                      <div style={{ ...inputBase, background: '#1a1d23', color: state.accountName ? 'var(--txt)' : 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {state.accountNameLoading ? (
                          <>
                            <div style={{ width: 12, height: 12, border: '2px solid var(--border)', borderTop: '2px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                            Resolving...
                          </>
                        ) : state.accountNameError ? (
                          <span style={{ color: '#ff6b6b' }}>{state.accountNameError}</span>
                        ) : state.accountName ? (
                          state.accountName
                        ) :
                          'Enter account number'
                        }
                      </div>
                    </label>

                    <div style={{ gridColumn: '1 / span 2', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                      <button
                        style={btnPrimary}
                        disabled={state.payLoading || !state.bankCode || state.banksLoading || !state.accountName}
                      >
                        {state.payLoading ? 'Saving…' : 'Save Payout & Show Summary'}
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* FINAL SUMMARY (countdown starts here) */}
              {state.initData && showFinalSummary && state.payData && (
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
                      <div style={vStyle}>{state.payData?.status}</div>
                    </div>
                    <div>
                      <div style={kStyle}>Payment ID</div>
                      <div style={{ ...vStyle, ...mono }}>{state.payData?.paymentId}</div>
                    </div>
                    <div>
                      <div style={kStyle}>Reference</div>
                      <div style={{ ...vStyle, ...mono }}>{state.initData?.reference}</div>
                    </div>
                    <div>
                      <div style={kStyle}>You Receive</div>
                      <div>
                        <div style={vStyle}>
                          {prettyNgn(state.initData?.quote.receiveAmount ?? 0)} ({state.initData?.quote.receiveCurrency})
                        </div>
                        <div style={{ ...smallMuted, marginTop: 4 }}>
                          Transaction fee (fixed): <strong>70&nbsp;NGN</strong>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div style={kStyle}>Rate</div>
                      <div style={vStyle}>{prettyAmount(state.initData?.quote.rate ?? 0)} NGN/{state.initData?.deposit.token}</div>
                    </div>
                    <div>
                      <div style={kStyle}>Bank</div>
                      <div style={vStyle}>{state.payData?.payout?.bankName}</div>
                    </div>
                    <div>
                      <div style={kStyle}>Account</div>
                      <div style={vStyle}>{state.payData?.payout?.accountName} — {state.payData?.payout?.accountNumber}</div>
                    </div>
                    <div>
                      <div style={kStyle}>Deposit Address</div>
                      <div style={{ ...vStyle, ...mono, wordBreak: 'break-all' }}>{state.initData?.deposit.address}</div>
                      <div style={row}>
                        <button
                          style={btn}
                          onClick={() => copyToClipboard(state.initData!.deposit.address, 'addr2')}
                        >
                          {copiedKey === 'addr2' ? 'Copied ✓' : 'Copy Address'}
                        </button>
                      </div>
                    </div>
                    {!!state.initData?.deposit.memo && (
                      <div>
                        <div style={kStyle}>Memo / Tag</div>
                        <div style={{ ...vStyle, ...mono, wordBreak: 'break-all' }}>{state.initData.deposit.memo}</div>
                        <div style={row}>
                          <button
                            style={btn}
                            onClick={() => copyToClipboard(state.initData!.deposit.memo!, 'memo2')}
                          >
                            {copiedKey === 'memo2' ? 'Copied ✓' : 'Copy Memo'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ ...smallMuted, ...badgeWarn }}>
                    ⚠️ Send exactly {prettyAmount(state.initData?.deposit.amount ?? 0)} {state.initData?.deposit.token} on {toNetworkLabel(state.initData?.deposit.token ?? '', state.initData?.deposit.network ?? '')} before the timer runs out.
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
            {state.flow === 'idle'
              ? 'We\'ll capture your payout next.'
              : (showFinalSummary
                ? 'Copy the deposit details and send the exact amount within the window.'
                : 'Ensure your bank details match your account name.')}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {state.flow === 'initiated' ? (
              !showFinalSummary ? (
                <button style={btn} onClick={() => { dispatch({ type: 'SET_FIELD', key: 'flow', value: 'idle' }) }}>← Back</button>
              ) : (
                <button style={btn} onClick={onClose}>Close</button>
              )
            ) : state.flow === 'complete' ? (
              <button style={btn} onClick={onClose}>Close</button>
            ) : (
              <button style={btn} onClick={onClose}>Cancel</button>
            )}
          </div>
        </div>
      </div>

      <style>
        {`@keyframes scaleIn{from{transform:translateY(8px) scale(.98); opacity:0} to{transform:none; opacity:1}} @keyframes spin{from{transform:rotate(0deg)} to{transform:rotate(360deg)}}`}
      </style>
    </div>,
    document.body
  )
}
