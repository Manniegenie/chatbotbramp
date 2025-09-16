// src/App.tsx
import React, { useEffect, useRef, useState } from 'react'
import SignIn, { SignInResult } from './signin'
import SignUp, { SignUpResult } from './signup'
import { tokenStore } from './lib/secureStore'
import SellModal from './sell'
import BuyModal from './buy'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'

type CTAButton = {
  id: string
  title: string
  style?: 'primary' | 'secondary' | string
  url: string
}
type CTA = {
  type: 'button'
  body: string
  buttons: CTAButton[]
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  ts: number
  cta?: CTA | null
}

// --- session id (stable across page loads) ---
function getSessionId(): string {
  const key = 'bramp__session_id'
  let sid = localStorage.getItem(key)
  if (!sid) {
    sid = crypto.randomUUID()
    localStorage.setItem(key, sid)
  }
  return sid
}

// Helper function to get time-based greeting
function getTimeBasedGreeting(): string {
  const hour = new Date().getHours()

  if (hour < 12) {
    return 'Good morning'
  } else if (hour < 18) {
    return 'Good afternoon'
  } else {
    return 'Good evening'
  }
}

// Always read the freshest token from secure storage
function isExpiredJwt(token: string): boolean {
  try {
    const [, payloadB64] = token.split('.')
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    const { exp } = JSON.parse(json)
    return !exp || Date.now() >= exp * 1000
  } catch { return true }
}

async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { access } = tokenStore.getTokens()
  const headers = new Headers(init.headers || {})
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (access && !isExpiredJwt(access)) headers.set('Authorization', `Bearer ${access}`)
  return fetch(input, { ...init, headers })
}

/* ----------------------- Error helper ----------------------- */
function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try { return JSON.stringify(e) } catch { return String(e) }
}

async function sendChatMessage(
  message: string,
  history: ChatMessage[]
): Promise<{ reply: string; cta?: CTA | null; metadata?: any }> {
  const { access } = tokenStore.getTokens()

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (access && !isExpiredJwt(access)) headers['Authorization'] = `Bearer ${access}`

  const response = await fetch(`${API_BASE}/chatbot/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message,
      history: history.slice(-10).map((m) => ({ role: m.role, text: m.text })),
      sessionId: getSessionId(),
    }),
    mode: 'cors',
    cache: 'no-store',
  })

  const data = await response.json()

  // Check backend success flag
  if (!data?.success) {
    // Throw error so catch block handles it
    throw new Error(data?.error || 'AI could not process your request.')
  }

  return {
    reply: data?.reply || '',
    cta: data.cta || null,
    metadata: data.metadata
  }
}


/* ----------------------- Linkify + Markdown-lite helpers ----------------------- */

const URL_REGEX = /https?:\/\/[^\s<>"')]+/gi
const MD_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g

function shortenUrlForDisplay(raw: string) {
  try {
    const u = new URL(raw)
    const host = u.host.replace(/^www\./, '')
    let path = u.pathname || ''
    if (path.length > 20) {
      const segs = path.split('/').filter(Boolean)
      if (segs.length > 2) path = `/${segs[0]}/…/${segs[segs.length - 1]}`
    }
    let label = host + (path === '/' ? '' : path)
    if (u.search || u.hash) label += '…'
    return label.length > 48 ? label.slice(0, 45) + '…' : label
  } catch {
    return raw.length > 48 ? raw.slice(0, 45) + '…' : raw
  }
}

function inlineRender(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let last = 0
  text.replace(MD_LINK, (match, label: string, url: string, offset: number) => {
    if (offset > last) nodes.push(text.slice(last, offset))
    nodes.push(
      <a key={`${keyPrefix}-md-${offset}`} href={url} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    )
    last = offset + match.length
    return match
  })
  if (last < text.length) nodes.push(text.slice(last))

  const finalNodes: React.ReactNode[] = []
  nodes.forEach((node, i) => {
    if (typeof node !== 'string') { finalNodes.push(node); return }
    let idx = 0
    node.replace(URL_REGEX, (url: string, offset: number) => {
      const trimmed = url.replace(/[),.;!?]+$/g, '')
      const trailing = url.slice(trimmed.length)
      if (offset > idx) finalNodes.push(node.slice(idx, offset))
      finalNodes.push(
        <a key={`${keyPrefix}-url-${i}-${offset}`} href={trimmed} target="_blank" rel="noopener noreferrer">
          {shortenUrlForDisplay(trimmed)}
        </a>
      )
      if (trailing) finalNodes.push(trailing)
      idx = offset + url.length
      return url
    })
    if (idx < node.length) finalNodes.push(node.slice(idx))
  })

  return finalNodes
}

function renderMessageText(text: string): React.ReactNode {
  const paragraphs = text.split(/\r?\n\s*\r?\n/)
  const rendered: React.ReactNode[] = []

  paragraphs.forEach((para, pi) => {
    const lines = para.split(/\r?\n/)
    const isListBlock = lines.length > 1 && lines.every((l) => l.trim().startsWith('- '))
    if (isListBlock) {
      rendered.push(
        <ul key={`ul-${pi}`} style={{ margin: '8px 0', paddingLeft: 18 }}>
          {lines.map((l, li) => {
            const item = l.replace(/^\s*-\s*/, '')
            return (
              <li key={`li-${pi}-${li}`} style={{ margin: '4px 0' }}>
                {inlineRender(item, `li-${pi}-${li}`)}
              </li>
            )
          })}
        </ul>
      )
    } else {
      const pieces = para.split(/\r?\n/)
      rendered.push(
        <p key={`p-${pi}`} style={{ margin: '8px 0' }}>
          {pieces.map((line, li) => (
            <React.Fragment key={`p-${pi}-line-${li}`}>
              {inlineRender(line, `p-${pi}-line-${li}`)}
              {li < pieces.length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>
      )
    }
  })

  return rendered
}

// Three dot loading component
function ThreeDotLoader() {
  return (
    <div className="typing">
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <div style={{
          width: '6px',
          height: '6px',
          backgroundColor: 'var(--muted)',
          borderRadius: '50%',
          animation: 'dotBounce 1.4s ease-in-out infinite both',
          animationDelay: '-0.32s'
        }}></div>
        <div style={{
          width: '6px',
          height: '6px',
          backgroundColor: 'var(--muted)',
          borderRadius: '50%',
          animation: 'dotBounce 1.4s ease-in-out infinite both',
          animationDelay: '-0.16s'
        }}></div>
        <div style={{
          width: '6px',
          height: '6px',
          backgroundColor: 'var(--muted)',
          borderRadius: '50%',
          animation: 'dotBounce 1.4s ease-in-out infinite both',
          animationDelay: '0s'
        }}></div>
      </div>
      <style>{`
        @keyframes dotBounce {
          0%, 80%, 100% {
            transform: scale(0.8);
            opacity: 0.5;
          }
          40% {
            transform: scale(1.2);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

/* ----------------------------------- App ----------------------------------- */

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      text:
        "👋 Hey there! I'm Bramp AI — your personal assistant for everything crypto. Please Sign up or Sign in for full access😊",
      ts: Date.now(),
    },
  ])

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const [showSignIn, setShowSignIn] = useState(false)
  const [showSignUp, setShowSignUp] = useState(false)
  const [showSell, setShowSell] = useState(false)
  const [showBuy, setShowBuy] = useState(false)

  const [openSellAfterAuth, setOpenSellAfterAuth] = useState(false)
  const [openBuyAfterAuth, setOpenBuyAfterAuth] = useState(false)

  const [auth, setAuth] = useState<SignInResult | null>(() => {
    const { access, refresh } = tokenStore.getTokens()
    const user = tokenStore.getUser()
    return access && refresh && user ? { accessToken: access, refreshToken: refresh, user } : null
  })

  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null) // Add ref for input focus management

  // New state: prices for marquee (initially empty)
  const [tickerText, setTickerText] = useState<string>('')
  // keep a loading flag internally but DO NOT display loading text in UI
  const [tickerLoading, setTickerLoading] = useState<boolean>(false)

  // Scrub sensitive URL params on load
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      let changed = false
      for (const p of ['user_id', 'token', 'code']) {
        if (url.searchParams.has(p)) { url.searchParams.delete(p); changed = true }
      }
      if (changed) {
        const clean = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') + url.hash
        window.history.replaceState({}, '', clean)
      }
    } catch { /* noop */ }
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, showSignIn, showSignUp, showSell, showBuy])

  /* ------------------- Price ticker: fetch & formatting ------------------- */
  const TICKER_SYMBOLS = ['BTC','ETH','USDT','USDC','BNB','MATIC','AVAX','SOL','NGNB']

  async function fetchTickerPrices(signal?: AbortSignal) {
    try {
      setTickerLoading(true)
      const symbolParam = TICKER_SYMBOLS.join(',')
      const url = `${API_BASE}/prices/prices?symbols=${encodeURIComponent(symbolParam)}&changes=true&limit=9`
      const resp = await authFetch(url, { method: 'GET', signal })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
      const payload = await resp.json()
      if (!payload?.success || !payload?.data) {
        throw new Error('Invalid prices response')
      }
      const { prices = {}, hourlyChanges = {} } = payload.data

      // format items without tail text and without emojis
      const items = TICKER_SYMBOLS.filter(s => (s === 'NGNB') || typeof prices[s] === 'number').map((s) => {
        const priceVal = prices[s]
        const changeObj = hourlyChanges?.[s]
        const changePct = changeObj?.hourlyChange ?? changeObj?.percentageChange ?? null
        if (s === 'NGNB') {
          if (typeof priceVal === 'number') {
            const ngn = Number(priceVal)
            return `NGNB ₦${ngn.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
          }
          return 'NGNB — n/a'
        }
        if (typeof priceVal !== 'number') return `${s} — n/a`
        const usd = Number(priceVal)
        const changeText = changePct != null ? ` (${changePct > 0 ? '+' : ''}${Number(changePct).toFixed(2)}%)` : ''
        const usdStr = usd >= 1 ? usd.toLocaleString(undefined, { maximumFractionDigits: 2 }) : usd.toFixed(6).replace(/\.?0+$/, '')
        return `${s} $${usdStr}${changeText}`
      }).filter(Boolean)

      // join with bullet separators (no tail text)
      const text = items.join('  •  ')
      setTickerText(text)
    } catch (err) {
      // on failure, keep tickerText empty (silent background load)
      console.warn('Ticker fetch failed', err)
      // do not modify UI visible text; keep it blank if nothing fetched
    } finally {
      setTickerLoading(false)
    }
  }

  useEffect(() => {
    const ac = new AbortController()
    // load once in background on mount (no visible loading placeholder)
    fetchTickerPrices(ac.signal).catch(() => { /* swallowed */ })
    return () => ac.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Header pin/shadow logic
  const headerRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const h = headerRef.current
    if (!h) return
    const onScroll = () => {
      if (window.scrollY > 8) h.classList.add('pinned')
      else h.classList.remove('pinned')
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || loading) return

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: trimmed, ts: Date.now() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Maintain focus on input after clearing
    setTimeout(() => {
      inputRef.current?.focus()
    }, 0)

    try {
      const data = await sendChatMessage(trimmed, [...messages, userMsg])

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: data.reply,
        ts: Date.now(),
        cta: data.cta || null
      }

      setMessages((prev) => [...prev, aiMsg])

    } catch (error) {
      console.error('Chat message failed:', error)
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: `Error reaching server: ${getErrorMessage(error)}`,
        ts: Date.now()
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
      // Ensure focus is maintained even after loading is complete
      setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
    }
  }

  function signOut() {
    tokenStore.clear()
    setAuth(null)
    setShowSell(false)
    setShowBuy(false)
  }

  function isSellCTA(btn: CTAButton): boolean {
    if (!btn) return false
    if (btn.id === 'start_sell') return true
    const url = String(btn.url || '').toLowerCase()
    const sellPatterns = [/\/sell($|\/|\?|#)/, /chatbramp\.com\/sell/, /localhost.*\/sell/, /sell\.html?$/, /\bsell\b/]
    return sellPatterns.some((rx) => rx.test(url))
  }

  function handleSellClick(event?: React.MouseEvent) {
    event?.preventDefault()
    if (!auth) {
      setOpenSellAfterAuth(true)
      setShowSignIn(true)
      return
    }
    setShowSell(true)
  }

  function handleBuyClick(event?: React.MouseEvent) {
    event?.preventDefault()
    if (!auth) {
      setOpenBuyAfterAuth(true)
      setShowSignIn(true)
      return
    }
    setShowBuy(true)
  }

  function echoFromModalToChat(text: string) {
    if (!text) return
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', text, ts: Date.now() }])
  }

  // Helper function for hint clicks
  function handleHintClick(hintText: string) {
    if (!loading) {
      setInput(hintText)
      // Focus input after setting hint text
      setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
    }
  }

  return (
    <>
      <style>
        {`
          /* Fix iOS viewport issues */
          @supports (-webkit-touch-callout: none) {
            html {
              height: -webkit-fill-available;
            }
            body {
              min-height: 100vh;
              min-height: -webkit-fill-available;
            }
            .page {
              min-height: 100vh;
              min-height: -webkit-fill-available;
            }
          }

          /* Prevent safe area displacement during scroll */
          @media (max-width: 480px) {
            .composer {
              padding-bottom: max(10px, env(safe-area-inset-bottom)) !important;
            }
            .footer {
              padding-bottom: max(14px, calc(14px + env(safe-area-inset-bottom))) !important;
            }
          }

          /* Animation for spinner */
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          /* Header sticky/pinned */
          .header {
            position: sticky;
            top: 0;
            z-index: 60;
            background: linear-gradient(180deg, rgba(18,18,26,0.95), rgba(18,18,26,0.8));
            backdrop-filter: blur(6px);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 16px;
            transition: box-shadow 200ms ease, transform 160ms ease;
          }
          .header.pinned {
            box-shadow: 0 6px 20px rgba(0,0,0,0.25);
            transform: translateY(0);
          }

          .brand { display:flex; align-items:center; gap:12px; min-width:0; flex:1; }
          .tag { font-size: 14px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

          /* Ticker / marquee */
          .ticker-wrap {
            position: relative;
            height: 28px;
            display: flex;
            align-items: center;
            overflow: hidden;
            width: 100%;
            min-width: 160px;
          }
          .ticker {
            display: inline-block;
            white-space: nowrap;
            will-change: transform;
            animation: tickerScroll 18s linear infinite;
            padding-left: 100%;
            box-sizing: content-box;
            font-weight: 600;
            font-size: 13px;
            color: var(--accent); /* use green accent for ticker text */
          }

          /* fade edges */
          .ticker-wrap::before,
          .ticker-wrap::after {
            content: "";
            position: absolute;
            top: 0;
            bottom: 0;
            width: 64px;
            pointer-events: none;
          }
          .ticker-wrap::before {
            left: 0;
            background: linear-gradient(90deg, rgba(18,18,26,1) 0%, rgba(18,18,26,0) 100%);
          }
          .ticker-wrap::after {
            right: 0;
            background: linear-gradient(270deg, rgba(18,18,26,1) 0%, rgba(18,18,26,0) 100%);
          }

          @keyframes tickerScroll {
            0% { transform: translateX(0%); }
            100% { transform: translateX(-50%); }
          }

          .ticker.idle {
            animation: none;
            padding-left: 0;
            transform: none;
          }

          @media (max-width: 640px) {
            .ticker { font-size: 12px; }
            .tag { display:block; max-width: 40%; overflow: hidden; text-overflow: ellipsis; }
          }
        `}
      </style>
      <div className="page">
        <header ref={headerRef} className="header">
          <div className="brand">
            <p className="tag">Secure access to digital assets & payments — via licensed partners.</p>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="ticker-wrap" aria-live="polite" aria-atomic="true">
                <div
                  className={`ticker ${tickerText.length < 40 ? 'idle' : ''}`}
                  key={tickerText}
                  title={tickerText}
                  style={{
                    animationDuration: tickerText.length < 80 ? '14s' : `${Math.min(Math.max(tickerText.length / 6, 18), 36)}s`
                  }}
                >
                  {tickerText ? `${tickerText}  ${tickerText}` : ''}
                </div>
              </div>
            </div>
          </div>

          {!auth ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => setShowSignIn(true)}>Sign in</button>
              <button
                className="btn"
                style={{ background: 'transparent', color: 'var(--txt)', border: '1px solid var(--border)' }}
                onClick={() => setShowSignUp(true)}
              >
                Sign up
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                Signed in{auth.user?.username ? ` as ${auth.user.username}` : ''}
              </span>
              <button className="btn" onClick={handleBuyClick} style={{ background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
                Buy
              </button>
              <button className="btn" onClick={handleSellClick} style={{ background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
                Sell
              </button>
              <button
                className="btn"
                style={{ background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)' }}
                onClick={signOut}
              >
                Sign out
              </button>
            </div>
          )}
        </header>

        {showSignIn ? (
          <SignIn
            onCancel={() => { setShowSignIn(false); setOpenSellAfterAuth(false); setOpenBuyAfterAuth(false) }}
            onSuccess={(res) => {
              setAuth(res)
              setShowSignIn(false)
              const greeting = getTimeBasedGreeting()
              const name = res.user.username || (res.user as any).firstname || 'there'
              setMessages([{
                id: crypto.randomUUID(),
                role: 'assistant',
                text: `${greeting}, ${name}, what would you like me to do for you today?`,
                ts: Date.now(),
              }])
              if (openSellAfterAuth) { setOpenSellAfterAuth(false); setShowSell(true) }
              if (openBuyAfterAuth)  { setOpenBuyAfterAuth(false);  setShowBuy(true) }
            }}
          />
        ) : showSignUp ? (
          <SignUp
            onCancel={() => setShowSignUp(false)}
            onSuccess={(_res: SignUpResult) => {
              setShowSignUp(false)
              setMessages((prev) => [...prev, {
                id: crypto.randomUUID(),
                role: 'assistant',
                text: 'Account created. Please verify OTP to complete your signup.',
                ts: Date.now(),
              }])
              setShowSignIn(true)
            }}
          />
        ) : (
          <main className="chat">
            <div className="messages">
              {messages.map((m) => (
                <div key={m.id} className={`bubble ${m.role}`}>
                  <div className="role">
                    {m.role === 'user' ? 'You' : 'Bramp AI'}
                  </div>
                  <div className="text">
                    {renderMessageText(m.text)}
                    {m.role === 'assistant' && m.cta?.type === 'button' && m.cta.buttons?.length > 0 && (
                      <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {m.cta.buttons.map((btn, index) => {
                          const isSell = isSellCTA(btn)
                          if (isSell) {
                            return (
                              <button
                                key={btn.id || btn.title || index}
                                className="btn"
                                onClick={handleSellClick}
                                style={
                                  btn.style === 'primary'
                                    ? undefined
                                    : { background: 'transparent', border: '1px solid var(--border)', color: 'var(--txt)' }
                                }
                              >
                                {btn.title}
                              </button>
                            )
                          }
                          return (
                            <a
                              key={btn.id || btn.title || index}
                              className="btn"
                              href={btn.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={
                                btn.style === 'primary'
                                  ? undefined
                                  : { background: 'transparent', border: '1px solid var(--border)', color: 'var(--txt)' }
                              }
                            >
                              {btn.title}
                            </a>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && <ThreeDotLoader />}
              <div ref={endRef} />
            </div>

            <form className="composer" onSubmit={sendMessage}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={loading ? 'Please wait…' : 'Try: Sell 100 USDT to NGN'}
                autoFocus
                disabled={loading}
              />
              <button
                type="submit"
                className="btn"
                disabled={loading || !input.trim()}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0',
                  background: loading || !input.trim() ? '#ccc' : 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: loading || !input.trim() ? 'none' : '0 2px 8px rgba(0,115,55,0.18)',
                  minWidth: '44px',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => {
                  if (!loading && input.trim()) {
                    e.currentTarget.style.transform = 'scale(1.05)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,115,55,0.26)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = loading || !input.trim() ? 'none' : '0 2px 8px rgba(0,115,55,0.18)'
                }}
              >
                {loading ? (
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid transparent',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22,2 15,22 11,13 2,9" />
                  </svg>
                )}
              </button>
            </form>

            <div className="hints">
              <span className="hint" onClick={() => handleHintClick('Sell 100 USDT to NGN')}>Sell 100 USDT to NGN</span>
              <span className="hint" onClick={() => handleHintClick('Show my portfolio balance')}>Show my portfolio balance</span>
              <span className="hint" onClick={() => handleHintClick('Current NGN rates')}>Current NGN rates</span>
            </div>
          </main>
        )}

        <SellModal open={showSell} onClose={() => setShowSell(false)} onChatEcho={echoFromModalToChat} />
        <BuyModal  open={showBuy}  onClose={() => setShowBuy(false)}  onChatEcho={echoFromModalToChat} />

        <footer className="footer">
          <a href="https://drive.google.com/file/d/11qmXGhossotfF4MTfVaUPac-UjJgV42L/view?usp=drive_link" target="_blank" rel="noopener noreferrer">AML/CFT Policy</a>
          <a href="https://drive.google.com/file/d/1FjCZHHg0KoOq-6Sxx_gxGCDhLRUrFtw4/view?usp=sharing" target="_blank" rel="noopener noreferrer">Risk Disclaimer</a>
          <a href="https://drive.google.com/file/d/1brtkc1Tz28Lk3Xb7C0t3--wW7829Txxw/view?usp=drive_link" target="_blank" rel="noopener noreferrer">Privacy</a>
          <a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a>
        </footer>
      </div>
    </>
  )
}