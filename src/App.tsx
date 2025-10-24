// src/App.tsx
import React, { useEffect, useRef, useState } from 'react'
import SignIn, { SignInResult } from './signin'
import SignUp, { SignUpResult } from './signup'
import { tokenStore } from './lib/secureStore'
import { authFetch, getAuthState, setupAutoLogoutTimer, clearAuth } from './lib/tokenManager'
import SellModal from './sell'
import WallpaperSlideshow from './WallpaperSlideshow'
// Import logo from assets
import BrampLogo from './assets/logo.jpeg' // Placeholder path

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

// Token management functions are now imported from tokenManager.ts

/* ----------------------- Error helper ----------------------- */
function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try { return JSON.stringify(e) } catch { return String(e) }
}

// Simple API call without streaming
async function sendChatMessage(
  message: string,
  history: ChatMessage[]
): Promise<{ reply: string; cta?: CTA | null; metadata?: any }> {
  const response = await authFetch(`${API_BASE}/chatbot/chat`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      history: history.slice(-10).map((m) => ({ role: m.role, text: m.text })),
      sessionId: getSessionId(),
    }),
    mode: 'cors',
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()
  return {
    reply: data?.reply ?? 'Sorry, I could not process that.',
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

  // Handle **bold** text first
  text.replace(/\*\*(.*?)\*\*/g, (match, content: string, offset: number) => {
    if (offset > last) nodes.push(text.slice(last, offset))
    nodes.push(
      <strong key={`${keyPrefix}-bold-${offset}`}>
        {content}
      </strong>
    )
    last = offset + match.length
    return match
  })

  if (last < text.length) {
    const remainingText = text.slice(last)
    let linkLast = 0
    remainingText.replace(MD_LINK, (match, label: string, url: string, offset: number) => {
      if (offset > linkLast) nodes.push(remainingText.slice(linkLast, offset))
      nodes.push(
        <a key={`${keyPrefix}-md-${offset}`} href={url} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      )
      linkLast = offset + match.length
      return match
    })
    if (linkLast < remainingText.length) nodes.push(remainingText.slice(linkLast))
  }

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
        "🚀Ready to move your crypto? Sign in to send or pay instantly to any Naira bank account🏦.",
      ts: Date.now(),
    },
  ])

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)

  const [showSignIn, setShowSignIn] = useState(false)
  const [showSignUp, setShowSignUp] = useState(false)
  const [showSell, setShowSell] = useState(false)
  const [openSellAfterAuth, setOpenSellAfterAuth] = useState(false)

  const [auth, setAuth] = useState<SignInResult | null>(() => {
    const authState = getAuthState()
    if (authState.isAuthenticated) {
      const { access, refresh } = tokenStore.getTokens()
      const user = tokenStore.getUser()
      return { accessToken: access!, refreshToken: refresh!, user }
    }
    return null
  })

  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Parse **text** to <strong>text</strong>
  function parseBoldText(text: string): string {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  } // Add ref for input focus management

  // New state: prices for marquee (initially empty)
  const [tickerText, setTickerText] = useState<string>('')
  // keep a loading flag internally but DO NOT display loading text in UI
  const [tickerLoading, setTickerLoading] = useState<boolean>(false)

  // Handle initial loading animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false)
    }, 1500) // Show loading for 1.5 seconds

    return () => clearTimeout(timer)
  }, [])

  // Scrub sensitive URL params on load and setup token refresh timer
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

    // Setup automatic logout timer
    const cleanup = setupAutoLogoutTimer((reason) => {
      // Handle auto-logout
      console.log('Auto-logout triggered:', reason)
      setAuth(null)
      setShowSell(false)

      // Show appropriate message based on reason
      const message = reason === 'token_expired'
        ? 'Your session has expired. Please sign in again.'
        : 'Session timeout reached. Please sign in again.'

      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: message,
        ts: Date.now(),
      }])
    })

    return cleanup
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, showSignIn, showSignUp, showSell])

  /* ------------------- Price ticker: fetch & formatting ------------------- */
  const TICKER_SYMBOLS = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'NGNB']

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
    clearAuth()
    setAuth(null)
    setShowSell(false)
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

  function handleKycClick(event?: React.MouseEvent) {
    event?.preventDefault()
    // KYC functionality disabled for now
    console.log('KYC button clicked - functionality disabled')
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

  // Show loading screen during initial load
  if (isInitialLoading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #0a0b0f 0%, #1a1d23 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        color: 'white'
      }}>
        {/* Logo/Brand */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #007337 0%, #00a847 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
          animation: 'pulse 2s ease-in-out infinite'
        }}>
          <span style={{ fontSize: '32px' }}>🚀</span>
        </div>

        {/* Loading text */}
        <h1 style={{
          fontSize: '24px',
          fontWeight: '700',
          margin: '0 0 8px 0',
          background: 'linear-gradient(135deg, #007337 0%, #00a847 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          Bramp
        </h1>

        <p style={{
          fontSize: '16px',
          color: '#a0a0a0',
          margin: '0 0 32px 0',
          textAlign: 'center'
        }}>
          Loading your crypto experience...
        </p>

        {/* Loading spinner */}
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(255, 255, 255, 0.1)',
          borderTop: '3px solid #007337',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />

        {/* CSS Animations */}
        <style>
          {`
            @keyframes pulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.05); }
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    )
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
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 16px;
            transition: box-shadow 200ms ease, transform 160ms ease;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
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
            transform: translateZ(0);
            -webkit-transform: translateZ(0);
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
          }
          .ticker-wrap::after {
            right: 0;
          }

          @keyframes tickerScroll {
            0% { transform: translate3d(0%, 0, 0); }
            100% { transform: translate3d(-50%, 0, 0); }
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

          /* Footer: responsive layout and alignment fixes */
          .footer {
            padding: 12px 16px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
            color: rgba(255, 255, 255, 0.7);
          }

          /* groups inside footer for layout control */
          .footer-left,
          .footer-center,
          .footer-right {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          /* policy links row */
          .footer-links {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            align-items: center;
            justify-content: center;
          }

          .footer a {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.6);
            text-decoration: none;
            padding: 6px 0;
          }
          .footer a:hover {
            text-decoration: underline;
            color: rgba(255, 255, 255, 0.9);
          }

          .footer-brand {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 0;
          }
          .footer-brand img {
            width: 24px;
            height: 24px;
            object-fit: contain;
          }
          .footer-brand span {
            font-size: 14px;
            color: var(--txt);
            font-weight: 500;
          }

          .footer-center {
            text-align: center;
          }
          .footer-center .copyright {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.6);
            white-space: nowrap;
          }

          /* On small screens stack nicely */
          @media (max-width: 640px) {
            .footer {
              justify-content: center;
              text-align: center;
            }
            .footer-left, .footer-right {
              width: 100%;
              justify-content: center;
            }
            .footer-center {
              width: 100%;
              margin-top: 6px;
            }
          }
        `}
      </style>
      <div className="page">
        <WallpaperSlideshow />
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
              <button className="btn" onClick={handleSellClick}>
                Pay
              </button>
              <button className="btn" onClick={handleKycClick} style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                KYC
              </button>
              <button className="btn" onClick={signOut}>
                Sign out
              </button>
            </div>
          )}
        </header>

        {showSignIn ? (
          <SignIn
            onCancel={() => { setShowSignIn(false); setOpenSellAfterAuth(false) }}
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
            }}
          />
        ) : showSignUp ? (
          <SignUp
            onCancel={() => setShowSignUp(false)}
            onSuccess={(res: SignUpResult) => {
              setShowSignUp(false)
              if (res.accessToken && res.refreshToken) {
                // User is already authenticated, route to main app
                tokenStore.setTokens(res.accessToken, res.refreshToken)
                if (res.user) {
                  tokenStore.setUser(res.user)
                }
                setAuth({
                  accessToken: res.accessToken,
                  refreshToken: res.refreshToken,
                  user: res.user
                })
                setMessages((prev) => [...prev, {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  text: 'Welcome! Your account has been created successfully.',
                  ts: Date.now(),
                }])
              } else {
                // User needs to verify OTP, show signin
                setMessages((prev) => [...prev, {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  text: 'Account created! Please sign in to continue.',
                  ts: Date.now(),
                }])
                setShowSignIn(true)
              }
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

        <footer className="footer">
          <div className="footer-left">
            <div className="footer-links">
              <a href="https://drive.google.com/file/d/11qmXGhossotfF4MTfVaUPac-UjJgV42L/view?usp=drive_link" target="_blank" rel="noopener noreferrer">AML/CFT Policy</a>
              <a href="https://drive.google.com/file/d/1FjCZHHg0KoOq-6Sxx_gxGCDhLRUrFtw4/view?usp=sharing" target="_blank" rel="noopener noreferrer">Risk Disclaimer</a>
              <a href="https://drive.google.com/file/d/1brtkc1Tz28Lk3Xb7C0t3--wW7829Txxw/view?usp=drive_link" target="_blank" rel="noopener noreferrer">Privacy</a>
              <a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a>
            </div>
          </div>

          <div className="footer-center">
          </div>

          <div className="footer-right">
            <div className="footer-brand">
              <img
                src={BrampLogo}
                alt="Bramp Africa Logo"
                width="24"
                height="24"
                onError={(e) => {
                  // Fallback to a placeholder if logo fails to load
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span></span>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}