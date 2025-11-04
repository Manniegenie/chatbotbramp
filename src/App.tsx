// src/App.tsx
import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import SignIn, { SignInResult } from './signin'
import SignUp, { SignUpResult } from './signup'
import { tokenStore } from './lib/secureStore'
import { authFetch, getAuthState, setupAutoLogoutTimer, clearAuth } from './lib/tokenManager'
import { useInactivityTimer } from './lib/useInactivityTimer'
import SellModal from './sell'
import SpaceGame from './game'
import MobileGame from './MobileGame';
import MobileVoiceChat from './MobileVoiceChat';
// Import logo from assets
import BrampLogo from './assets/logo.jpeg'
import micIcon from './assets/mic.png'
import TetherIcon from './assets/tether.png'
import SolanaIcon from './assets/solana.png'
import TronIcon from './assets/tron.png'
import BitcoinIcon from './assets/bicoin.png'
import XrpIcon from './assets/xrp.png'
import ShibaIcon from './assets/shiba-inu.png'
import AstronautImg from './assets/astronaut.png'
import GodImg from './assets/god.png'

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
          {shortenUrlForDisplay(url)}
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
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCenteredInput, setShowCenteredInput] = useState(true)

  const [showSignIn, setShowSignIn] = useState(false)
  const [showSignUp, setShowSignUp] = useState(false)
  const [showSell, setShowSell] = useState(false)
  const [openSellAfterAuth, setOpenSellAfterAuth] = useState(false)
  const [showVoiceChat, setShowVoiceChat] = useState(false)
  const [shouldOpenSell, setShouldOpenSell] = useState(false)
  const [showGame, setShowGame] = useState(false)

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
  const messagesRef = useRef<HTMLDivElement>(null)

  const icons = [TetherIcon, SolanaIcon, TronIcon, BitcoinIcon, XrpIcon, ShibaIcon]
  const [currentIconIndex, setCurrentIconIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Parse **text** to <strong>text</strong>
  function parseBoldText(text: string): string {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  } // Add ref for input focus management

  // New state: prices for marquee (initially empty)
  const [tickerText, setTickerText] = useState<string>('')
  // keep a loading flag internally but DO NOT display loading text in UI
  const [tickerLoading, setTickerLoading] = useState<boolean>(false)


  // Clean URL on load (background operation)
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
      // Handle auto-logout gracefully
      console.log('Auto-logout triggered:', reason)

      // Clear auth state
      setAuth(null)
      setShowSell(false)
      setShowSignIn(false)
      setShowSignUp(false)
      setOpenSellAfterAuth(false)

      // Smooth transition back to centered input view
      setShowCenteredInput(true)
      setMessages([])
    })

    return cleanup
  }, [])

  // 45-minute inactivity timer
  useInactivityTimer({
    timeout: 45 * 60 * 1000, // 45 minutes
    onInactive: () => {
      console.log('45 minutes of inactivity detected, returning to centered input')
      setShowCenteredInput(true)
      setMessages([])
    }
  })


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

  // Cycle through icons
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIconIndex((prev) => (prev + 1) % icons.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [icons.length])


  // Handle scrollbar auto-hide on messages container
  useEffect(() => {
    const messagesEl = messagesRef.current
    if (!messagesEl) return

    let scrollTimeout: number | null = null
    let clickTimeout: number | null = null

    const handleScroll = () => {
      messagesEl.classList.add('scrolling')
      if (scrollTimeout) window.clearTimeout(scrollTimeout)
      scrollTimeout = window.setTimeout(() => {
        messagesEl.classList.remove('scrolling')
      }, 1500) // Hide after 1.5 seconds of no scrolling
    }

    const handleClick = () => {
      messagesEl.classList.add('scrolling')
      if (clickTimeout) window.clearTimeout(clickTimeout)
      clickTimeout = window.setTimeout(() => {
        messagesEl.classList.remove('scrolling')
      }, 2000) // Hide after 2 seconds of no interaction
    }

    messagesEl.addEventListener('scroll', handleScroll, { passive: true })
    messagesEl.addEventListener('click', handleClick, { passive: true })

    return () => {
      messagesEl.removeEventListener('scroll', handleScroll)
      messagesEl.removeEventListener('click', handleClick)
      if (scrollTimeout) window.clearTimeout(scrollTimeout)
      if (clickTimeout) window.clearTimeout(clickTimeout)
    }
  }, [messages])

  // Handle automatic sell modal opening
  useEffect(() => {
    if (shouldOpenSell && !showSell) {
      // Use the same logic as manual button click
      handleSellClick()
      setShouldOpenSell(false)
    }
  }, [shouldOpenSell, showSell, auth, setOpenSellAfterAuth, setShowSignIn, setShowCenteredInput, setShowSell])

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || loading) return

    // Switch to bottom input after first message
    if (showCenteredInput) {
      setShowCenteredInput(false)
    }

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

      // Check if this message contains sell intent and should open modal instead
      const hasSellIntent = data.cta?.buttons?.some(btn => isSellCTA(btn))
      if (hasSellIntent) {
        // Don't add the message to chat, just trigger modal opening
        setShouldOpenSell(true)
      } else {
        setMessages((prev) => [...prev, aiMsg])
      }


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
    setMessages([])
    setShowCenteredInput(true)
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
    setShowCenteredInput(false)
    setShowSell(true)
  }

  function handleKycClick(event?: React.MouseEvent) {
    event?.preventDefault()
    // KYC functionality disabled for now
    console.log('KYC button clicked - functionality disabled')
  }

  function handleGameClick(event?: React.MouseEvent) {
    event?.preventDefault()
    setShowGame(true)
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


  if (showGame) {
    return (
      <div className="page" style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
        <MobileGame onClose={() => setShowGame(false)} />
      </div>
    );
  }

  if (showVoiceChat) {
    return (
      <MobileVoiceChat
        isMobile={false}
        onClose={() => setShowVoiceChat(false)}
        onMessage={(text) => {
          // Echo voice assistant response to chat
          if (text) {
            echoFromModalToChat(text);
          }
        }}
        onSellIntent={() => {
          // Open sell modal when sell intent detected in voice chat
          setShowVoiceChat(false);
          setShowSell(true);
        }}
      />
    );
  }

  if (showSell) {
    return (
      <div className="page" style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
        <SellModal
          open={showSell}
          onClose={() => setShowSell(false)}
          onChatEcho={echoFromModalToChat}
          onStartInteraction={() => setShowCenteredInput(false)}
        />
      </div>
    );
  }

  if (showSignIn) {
    return (
      <div className="page" style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
        <SignIn
          onCancel={() => { setShowSignIn(false); setOpenSellAfterAuth(false) }}
          onSuccess={(res) => {
            setAuth(res)
            setShowSignIn(false)
            setShowCenteredInput(false)
            const greeting = getTimeBasedGreeting()
            const name = res.user.username || (res.user as any).firstname || 'there'
            setMessages([{ id: crypto.randomUUID(), role: 'assistant', text: `${greeting}, ${name}, what would you like me to do for you today?`, ts: Date.now() }])
            if (openSellAfterAuth) { setOpenSellAfterAuth(false); setShowSell(true) }
          }}
        />
      </div>
    );
  }

  if (showSignUp) {
    return (
      <div className="page" style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
        <SignUp
          onCancel={() => setShowSignUp(false)}
          onSuccess={(res: SignUpResult) => {
            setShowSignUp(false)
            if (res.accessToken && res.refreshToken) {
              tokenStore.setTokens(res.accessToken, res.refreshToken)
              setShowCenteredInput(false)
              if (res.user) {
                const user = {
                  id: res.userId || '',
                  phonenumber: res.user.phonenumber || '',
                  firstname: res.user.firstname,
                  lastname: res.user.lastname,
                  email: res.user.email,
                  username: res.user.username
                }
                tokenStore.setUser(user)
                setAuth({ accessToken: res.accessToken, refreshToken: res.refreshToken, user })
              } else {
                setAuth({ accessToken: res.accessToken, refreshToken: res.refreshToken, user: { id: res.userId || '', phonenumber: '' } })
              }
              setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: 'Welcome! Your account has been created successfully.', ts: Date.now() }])
            } else {
              setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: 'Account created! Please sign in to continue.', ts: Date.now() }])
              setShowSignIn(true)
            }
          }}
        />
      </div>
    );
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

          /* Disable scrolling on the page */
          .page {
            overflow: hidden;
            height: 100vh;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: transparent;
          }

          /* Enable scrolling on messages container */
          .messages {
            overflow-y: auto;
            overflow-x: hidden;
            height: calc(100vh - 200px);
            max-height: calc(100vh - 200px);
            -webkit-overflow-scrolling: touch;
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
          }

          /* Hide scrollbar by default, show on hover/scroll */
          .messages::-webkit-scrollbar {
            width: 8px;
          }

          .messages::-webkit-scrollbar-track {
            background: transparent;
          }

          .messages::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0);
            border-radius: 4px;
            transition: background 0.3s ease;
          }

          /* Show scrollbar on hover or when scrolling */
          .messages:hover::-webkit-scrollbar-thumb,
          .messages.scrolling::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
          }

          .messages:hover::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.5);
          }

          /* Ensure no scrollbars anywhere */
          html, body {
            overflow: hidden;
            height: 100%;
            margin: 0;
            padding: 0;
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
            border-bottom: none;
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
            animation: tickerScroll 35s linear infinite;
            padding-left: 100%;
            box-sizing: content-box;
            font-weight: 600;
            font-size: 9px;
            color: #007337;
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
            .ticker { font-size: 9px; }
            .tag { display:block; max-width: 40%; overflow: hidden; text-overflow: ellipsis; }
          }

          /* Footer: responsive layout and alignment fixes */
          .footer {
            padding: 12px 16px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            flex-wrap: wrap;
            color: #DADADA;
          }

          .footer-links {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            align-items: center;
            justify-content: center;
          }

          .footer a {
            font-size: 13px;
            color: #DADADA;
            text-decoration: none;
            padding: 6px 0;
          }
          .footer a:hover {
            text-decoration: underline;
            color: #DADADA;
          }
          
          .header-logo {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            object-fit: cover;
          }
          
          .brand-text {
            font-size: 18px;
            font-weight: 600;
            color: #007337;
          }
          
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
          
          /* Desktop Centered Input */
          .centered-input-desktop {
            position: absolute;
            top: 35%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: calc(100% - 32px);
            max-width: 580px;
            z-index: 10;
          }
          
          .desktop-app-logo {
            width: 89px;
            height: 89px;
            margin: 0 auto 12px;
            display: block;
            animation: fadeIn 0.5s ease-in-out;
            object-fit: contain;
          }
          
          .centered-form-desktop {
            display: flex;
            flex-direction: column;
            gap: 16px;
            width: 100%;
          }
          
          .input-centered-desktop {
            width: 100%;
            border-radius: 40px;
            padding: 28px;
            font-size: 18px;
            caret-color: var(--accent);
            box-sizing: border-box;
            min-height: 72px;
            background: rgba(18, 18, 26, 0.2);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            border: none;
            color: #DADADA;
            outline: none;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37),
                        inset 0 1px 1px rgba(255, 255, 255, 0.1);
            transition: all 0.3s ease;
          }
          
          .input-centered-desktop::placeholder {
            color: #DADADA;
          }
          
          .input-centered-desktop:focus {
            background: rgba(18, 18, 26, 0.3);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4),
                        inset 0 1px 1px rgba(255, 255, 255, 0.15);
          }
          
          .send-btn-inline-desktop {
            width: 52px;
            height: 52px;
            background: rgba(18, 18, 26, 0.2);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            cursor: pointer;
            padding: 0;
            flex-shrink: 0;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37),
                        inset 0 1px 1px rgba(255, 255, 255, 0.1);
            transition: all 0.3s ease;
            color: rgba(155, 163, 175, 0.8);
          }
          
          .send-btn-inline-desktop:hover:not(:disabled) {
            background: rgba(18, 18, 26, 0.3);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4),
                        inset 0 1px 1px rgba(255, 255, 255, 0.15);
          }
          
          .send-btn-inline-desktop:not(:disabled) {
            color: #007337;
          }
          
          .send-btn-inline-desktop:disabled {
            opacity: 1;
            cursor: not-allowed;
            color: rgba(155, 163, 175, 0.8);
          }
          
          .send-btn-inline-desktop svg {
            width: 24px;
            height: 24px;
          }
          
          .spinner-desktop {
            width: 20px;
            height: 20px;
            border: 2px solid transparent;
            border-top: 2px solid #DADADA;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          
          .astronaut-bg {
            position: fixed;
            bottom: calc(50% - 60px);
            left: 20px;
            width: 20px;
            height: auto;
            z-index: 1;
            pointer-events: none;
            opacity: 0.8;
          }
          
          .god-bg {
            position: fixed;
            bottom: calc(50% + 40px);
            right: 0;
            width: 40px;
            height: auto;
            z-index: 1;
            pointer-events: none;
            opacity: 0.8;
            transform: rotate(120deg);
          }
        `}
      </style>
      <div className="page">
        <header ref={headerRef} className="header">
          <div className="brand">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img
                src={BrampLogo}
                alt="Bramp"
                className="header-logo"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
          </div>

          {!auth ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => setShowSignIn(true)}>Sell</button>
              <button
                className="btn"
                style={{ background: 'transparent', color: 'var(--txt)', border: '1px solid #007337' }}
                onClick={() => setShowSignUp(true)}
              >
                Sign Up
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn" onClick={handleSellClick} style={{ color: '#DADADA' }}>
                Sell
              </button>
              <button className="btn" onClick={handleKycClick} style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                KYC
              </button>
              <button className="btn" onClick={handleGameClick} style={{ color: '#DADADA', border: '2px solid var(--accent)' }}>
                Game
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
              setShowCenteredInput(false)
              const greeting = getTimeBasedGreeting()
              const name = res.user.username || (res.user as any).firstname || 'there'
              setMessages([{
                id: crypto.randomUUID(),
                role: 'assistant',
                text: `${greeting}, ${name}, what would you like me to do for you today?`,
                ts: Date.now(),
              }])
              if (openSellAfterAuth) { setOpenSellAfterAuth(false); setShowSell(true) }

              // Track Facebook pixel CompleteRegistration event
              if (typeof window !== 'undefined' && window.fbq) {
                console.log('Firing Facebook pixel CompleteRegistration event (signin)');
                window.fbq('track', 'CompleteRegistration', {
                  value: 1,
                  currency: 'USD',
                });
              } else {
                console.warn('Facebook pixel not loaded or window.fbq not available (signin)');
              }
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
                setShowCenteredInput(false)
                if (res.user) {
                  // Create a proper user object with required fields
                  const user = {
                    id: res.userId || '',
                    phonenumber: res.user.phonenumber || '',
                    firstname: res.user.firstname,
                    lastname: res.user.lastname,
                    email: res.user.email,
                    username: res.user.username
                  }
                  tokenStore.setUser(user)
                  setAuth({
                    accessToken: res.accessToken,
                    refreshToken: res.refreshToken,
                    user
                  })
                } else {
                  setAuth({
                    accessToken: res.accessToken,
                    refreshToken: res.refreshToken,
                    user: { id: res.userId || '', phonenumber: '' }
                  })
                }
                setMessages((prev) => [...prev, {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  text: 'Welcome! Your account has been created successfully.',
                  ts: Date.now(),
                }])

                // Track Facebook pixel CompleteRegistration event
                if (typeof window !== 'undefined' && window.fbq) {
                  console.log('Firing Facebook pixel CompleteRegistration event');
                  window.fbq('track', 'CompleteRegistration', {
                    value: 1,
                    currency: 'USD',
                  });
                } else {
                  console.warn('Facebook pixel not loaded or window.fbq not available');
                }
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
            <div className="messages" ref={messagesRef}>
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

            {showCenteredInput ? (
              <div className="centered-input-desktop">
                <div className="centered-form-desktop">
                  <h2 style={{
                    position: 'absolute',
                    left: '-9999px',
                    top: '-9999px',
                    width: '1px',
                    height: '1px',
                    overflow: 'hidden',
                    visibility: 'hidden'
                  }}>
                    Secure Crypto to NGN Exchange
                  </h2>
                  <div style={{ height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={currentIconIndex}
                        src={icons[currentIconIndex]}
                        alt="Chat Bramp AI"
                        className="desktop-app-logo"
                        initial={{ opacity: 0, scale: 0.8, rotateY: -90 }}
                        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                        exit={{ opacity: 0, scale: 0.8, rotateY: 90 }}
                        transition={{
                          duration: 0.6,
                          ease: "easeInOut",
                          type: "spring",
                          stiffness: 100,
                          damping: 15
                        }}
                      />
                    </AnimatePresence>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
                    <input
                      ref={inputRef}
                      className="input-centered-desktop"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Try: Sell 100 USDT to NGN"
                      disabled={loading}
                    />
                    <button
                      type="submit"
                      className="send-btn-inline-desktop"
                      disabled={loading || !input.trim()}
                      aria-label="Send message"
                      onClick={sendMessage}
                    >
                      {loading ? (
                        <div className="spinner-desktop" />
                      ) : (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22,2 15,22 11,13 2,9" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <form className="composer" onSubmit={sendMessage}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage(e)
                    }
                  }}
                  placeholder={loading ? 'Please wait…' : 'Try: Sell 100 USDT to NGN'}
                  autoFocus
                  disabled={loading}
                />
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                      background: loading || !input.trim() ? 'transparent' : 'var(--accent)',
                      color: '#DADADA',
                      border: loading || !input.trim() ? 'none' : 'none',
                      cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: loading || !input.trim() ? 'none' : '0 2px 8px rgba(0,115,55,0.18)',
                      minWidth: '44px',
                      flexShrink: 0,
                      opacity: loading || !input.trim() ? 0.3 : 1
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
                        borderTop: '2px solid #DADADA',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                    ) : (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#DADADA"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22,2 15,22 11,13 2,9" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setShowVoiceChat(true)}
                    disabled={loading || !auth}
                    aria-label="Voice chat"
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      padding: '8px',
                      minWidth: '44px',
                      height: '44px',
                      width: '44px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: loading || !auth ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      flexShrink: 0
                    }}
                  >
                    <img src={micIcon} alt="Mic" style={{ width: '24px', height: '24px' }} />
                  </button>
                </div>
              </form>
            )}

            <div className="hints">
              <span className="hint" onClick={() => handleHintClick('Sell 100 USDT to NGN')}>Sell 100 USDT to NGN</span>
              <span className="hint" onClick={() => handleHintClick('Show my portfolio balance')}>Show my portfolio balance</span>
              <span className="hint" onClick={() => handleHintClick('Current NGN rates')}>Current NGN rates</span>
            </div>
          </main>
        )}

        <SellModal open={showSell} onClose={() => setShowSell(false)} onChatEcho={echoFromModalToChat} onStartInteraction={() => setShowCenteredInput(false)} />

        {showCenteredInput && (
          <footer className="footer">
            <div className="footer-links">
              <a href="https://drive.google.com/file/d/11qmXGhossotfF4MTfVaUPac-UjJgV42L/view?usp=drive_link" target="_blank" rel="noopener noreferrer">AML/CFT Policy</a>
              <a href="https://drive.google.com/file/d/1FjCZHHg0KoOq-6Sxx_gxGCDhLRUrFtw4/view?usp=sharing" target="_blank" rel="noopener noreferrer">Risk Disclaimer</a>
              <a href="https://drive.google.com/file/d/1brtkc1Tz28Lk3Xb7C0t3--wW7829Txxw/view?usp=drive_link" target="_blank" rel="noopener noreferrer">Privacy</a>
              <a href="/terms.html" target="_blank" rel="noopener noreferrer">Terms</a>
              <a href="https://www.youtube.com/@Chatbramp" target="_blank" rel="noopener noreferrer">YouTube</a>
              <a href="https://x.com/Chatbramp" target="_blank" rel="noopener noreferrer">Twitter</a>
              <a href="https://medium.com/@chatbramp" target="_blank" rel="noopener noreferrer">Medium</a>
            </div>
          </footer>
        )}
        <img
          src={AstronautImg}
          alt="Astronaut"
          className="astronaut-bg"
        />
        <img
          src={GodImg}
          alt="God"
          className="god-bg"
        />
      </div>

    </>
  )
}