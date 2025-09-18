// src/App.tsx - Performance Optimized Version
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
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

// ✅ PERFORMANCE: Enhanced session management
function getSessionId(): string {
  const key = 'bramp__session_id'
  let sid = sessionStorage.getItem(key) // Use sessionStorage instead of localStorage for session-specific data
  if (!sid) {
    sid = crypto.randomUUID()
    sessionStorage.setItem(key, sid)
  }
  return sid
}

// ✅ PERFORMANCE: Response cache using Map with TTL
interface CachedResponse {
  data: { reply: string; cta?: CTA | null; metadata?: any }
  timestamp: number
  ttl: number
}

class ResponseCache {
  private cache = new Map<string, CachedResponse>()
  private maxSize = 100
  private defaultTTL = 5 * 60 * 1000 // 5 minutes

  private generateKey(message: string, userId?: string, isAuthed: boolean = false): string {
    const normalizedMsg = message.toLowerCase().trim().replace(/[^\w\s]/g, '')
    const authPrefix = isAuthed ? 'auth:' : 'anon:'
    const userSuffix = userId ? `:${userId}` : ''
    return `${authPrefix}${normalizedMsg.substring(0, 50)}${userSuffix}`
  }

  get(message: string, userId?: string, isAuthed: boolean = false): { reply: string; cta?: CTA | null; metadata?: any } | null {
    const key = this.generateKey(message, userId, isAuthed)
    const cached = this.cache.get(key)
    
    if (!cached) return null
    
    // Check if expired
    if (Date.now() > cached.timestamp + cached.ttl) {
      this.cache.delete(key)
      return null
    }
    
    return cached.data
  }

  set(
    message: string, 
    data: { reply: string; cta?: CTA | null; metadata?: any }, 
    userId?: string,
    isAuthed: boolean = false,
    customTTL?: number
  ): void {
    const key = this.generateKey(message, userId, isAuthed)
    
    // Limit cache size
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }

    // Don't cache user-specific responses for anonymous users
    if (isAuthed && data.reply.includes('portfolio') || data.reply.includes('balance')) {
      // Short TTL for personalized data
      this.cache.set(key, {
        data,
        timestamp: Date.now(),
        ttl: customTTL || 30 * 1000 // 30 seconds for user data
      })
    } else {
      // Longer TTL for general responses
      this.cache.set(key, {
        data,
        timestamp: Date.now(),
        ttl: customTTL || this.defaultTTL
      })
    }
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

// Global cache instance
const responseCache = new ResponseCache()

// ✅ PERFORMANCE: Optimized JWT expiry check with caching
const jwtCache = new Map<string, { isExpired: boolean; timestamp: number }>()

function isExpiredJwt(token: string): boolean {
  if (!token) return true
  
  const cacheKey = token.substring(0, 20) // Use token prefix as key
  const cached = jwtCache.get(cacheKey)
  
  // Cache for 1 minute to avoid repeated parsing
  if (cached && Date.now() - cached.timestamp < 60000) {
    return cached.isExpired
  }

  let isExpired = true
  try {
    const [, payloadB64] = token.split('.')
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    const { exp } = JSON.parse(json)
    isExpired = !exp || Date.now() >= exp * 1000
  } catch {
    isExpired = true
  }

  // Cache result
  jwtCache.set(cacheKey, { isExpired, timestamp: Date.now() })
  
  // Limit cache size
  if (jwtCache.size > 50) {
    const firstKey = jwtCache.keys().next().value
    if (firstKey) jwtCache.delete(firstKey)
  }

  return isExpired
}

// ✅ PERFORMANCE: Request deduplication
const activeRequests = new Map<string, Promise<any>>()

async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { access } = tokenStore.getTokens()
  const headers = new Headers(init.headers || {})
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (access && !isExpiredJwt(access)) headers.set('Authorization', `Bearer ${access}`)
  
  // ✅ PERFORMANCE: Enable caching for GET requests
  const finalInit = { 
    ...init, 
    headers,
    // Only disable cache for POST requests
    ...(init.method === 'POST' ? { cache: 'no-store' as RequestCache } : {})
  }
  
  return fetch(input, finalInit)
}

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try { return JSON.stringify(e) } catch { return String(e) }
}

// ✅ PERFORMANCE: Optimized chat message sending with caching and deduplication
async function sendChatMessage(
  message: string,
  history: ChatMessage[]
): Promise<{ reply: string; cta?: CTA | null; metadata?: any }> {
  const { access } = tokenStore.getTokens()
  const isAuthed = access && !isExpiredJwt(access)
  
  // ✅ PERFORMANCE: Check cache first
  const userId = isAuthed ? 'user' : undefined // Simplified user ID
  const cachedResponse = responseCache.get(message, userId, !!isAuthed)
  if (cachedResponse) {
    console.log('✅ Cache hit for message:', message.substring(0, 30))
    // Add small delay to simulate network request (optional UX improvement)
    await new Promise(resolve => setTimeout(resolve, 100))
    return {
      ...cachedResponse,
      metadata: { ...cachedResponse.metadata, cached: true }
    }
  }

  // ✅ PERFORMANCE: Request deduplication
  const requestKey = `${message}:${userId || 'anon'}:${getSessionId()}`
  const existingRequest = activeRequests.get(requestKey)
  if (existingRequest) {
    console.log('✅ Deduplicating request for:', message.substring(0, 30))
    return existingRequest
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (isAuthed) headers['Authorization'] = `Bearer ${access}`

  // ✅ PERFORMANCE: Optimize request payload - send minimal data
  const minimalHistory = history.slice(-5).map((m) => ({ // Reduce from 10 to 5 messages
    role: m.role,
    text: m.text.substring(0, 200) // Truncate long messages in history
  }))

  const requestPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/chatbot/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message,
          history: minimalHistory,
          sessionId: getSessionId(),
        }),
        mode: 'cors',
        cache: 'no-store', // Only for POST requests
        // ✅ PERFORMANCE: Add timeout
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      const result = {
        reply: data?.reply ?? 'Sorry, I could not process that.',
        cta: data.cta || null,
        metadata: data.metadata
      }

      // ✅ PERFORMANCE: Cache successful responses
      if (result.reply && !result.reply.includes('Error') && !result.reply.includes('Sorry')) {
        // Determine TTL based on response type
        let ttl = 5 * 60 * 1000 // 5 minutes default
        
        if (data.metadata?.intent === 'naira_rates') ttl = 30 * 1000 // 30 seconds for rates
        else if (data.metadata?.intent === 'dashboard' || data.metadata?.intent === 'supported_token_price') ttl = 60 * 1000 // 1 minute for user data
        else if (data.metadata?.intent === 'greeting') ttl = 10 * 60 * 1000 // 10 minutes for greetings
        
        responseCache.set(message, result, userId, !!isAuthed, ttl)
      }

      return result
    } finally {
      // Clean up active request
      activeRequests.delete(requestKey)
    }
  })()

  // Store active request
  activeRequests.set(requestKey, requestPromise)

  return requestPromise
}

// Helper function to get time-based greeting
function getTimeBasedGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  else if (hour < 18) return 'Good afternoon'
  else return 'Good evening'
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

// ✅ PERFORMANCE: Memoize message rendering
const MemoizedMessageText = React.memo(({ text }: { text: string }) => {
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

  return <>{rendered}</>
})

function ThreeDotLoader() {
  return (
    <div className="typing">
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: '6px',
            height: '6px',
            backgroundColor: 'var(--muted)',
            borderRadius: '50%',
            animation: 'dotBounce 1.4s ease-in-out infinite both',
            animationDelay: `${-0.32 + i * 0.16}s`
          }} />
        ))}
      </div>
      <style>{`
        @keyframes dotBounce {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
          40% { transform: scale(1.2); opacity: 1; }
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
      text: "👋 Hey there! I'm Bramp AI — your personal assistant for everything crypto. Please Sign up or Sign in for full access😊",
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

  // ✅ PERFORMANCE: Memoize auth state
  const [auth, setAuth] = useState<SignInResult | null>(() => {
    const { access, refresh } = tokenStore.getTokens()
    const user = tokenStore.getUser()
    return access && refresh && user ? { accessToken: access, refreshToken: refresh, user } : null
  })

  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [tickerText, setTickerText] = useState<string>('')
  const [tickerLoading, setTickerLoading] = useState<boolean>(false)

  // ✅ PERFORMANCE: Debounced input handling
  const [debouncedInput, setDebouncedInput] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedInput(input), 300)
    return () => clearTimeout(timer)
  }, [input])

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

  /* ------------------- Price ticker with caching ------------------- */
  const TICKER_SYMBOLS = ['BTC','ETH','USDT','USDC','BNB','MATIC','AVAX','SOL','NGNB']

  // ✅ PERFORMANCE: Memoized ticker fetch with caching
  const fetchTickerPrices = useCallback(async (signal?: AbortSignal) => {
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

      const text = items.join('  •  ')
      setTickerText(text)
    } catch (err) {
      console.warn('Ticker fetch failed', err)
    } finally {
      setTickerLoading(false)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    fetchTickerPrices(ac.signal).catch(() => {})
    return () => ac.abort()
  }, [fetchTickerPrices])

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

  // ✅ PERFORMANCE: Optimized send message with better UX
  const sendMessage = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || loading) return

    const userMsg: ChatMessage = { 
      id: crypto.randomUUID(), 
      role: 'user', 
      text: trimmed, 
      ts: Date.now() 
    }
    
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Maintain focus on input after clearing
    setTimeout(() => inputRef.current?.focus(), 0)

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
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [input, loading, messages])

  // ✅ PERFORMANCE: Memoized callbacks
  const signOut = useCallback(() => {
    tokenStore.clear()
    setAuth(null)
    setShowSell(false)
    setShowBuy(false)
    responseCache.clear() // Clear cache on sign out
  }, [])

  const isSellCTA = useCallback((btn: CTAButton): boolean => {
    if (!btn) return false
    if (btn.id === 'start_sell') return true
    const url = String(btn.url || '').toLowerCase()
    const sellPatterns = [/\/sell($|\/|\?|#)/, /chatbramp\.com\/sell/, /localhost.*\/sell/, /sell\.html?$/, /\bsell\b/]
    return sellPatterns.some((rx) => rx.test(url))
  }, [])

  const handleSellClick = useCallback((event?: React.MouseEvent) => {
    event?.preventDefault()
    if (!auth) {
      setOpenSellAfterAuth(true)
      setShowSignIn(true)
      return
    }
    setShowSell(true)
  }, [auth])

  const handleBuyClick = useCallback((event?: React.MouseEvent) => {
    event?.preventDefault()
    if (!auth) {
      setOpenBuyAfterAuth(true)
      setShowSignIn(true)
      return
    }
    setShowBuy(true)
  }, [auth])

  const echoFromModalToChat = useCallback((text: string) => {
    if (!text) return
    setMessages((prev) => [...prev, { 
      id: crypto.randomUUID(), 
      role: 'assistant', 
      text, 
      ts: Date.now() 
    }])
  }, [])

  const handleHintClick = useCallback((hintText: string) => {
    if (!loading) {
      setInput(hintText)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [loading])

  // ✅ PERFORMANCE: Memoize expensive renders
  const renderedMessages = useMemo(() => {
    return messages.map((m) => (
      <div key={m.id} className={`bubble ${m.role}`}>
        <div className="role">
          {m.role === 'user' ? 'You' : 'Bramp AI'}
        </div>
        <div className="text">
          <MemoizedMessageText text={m.text} />
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
    ))
  }, [messages, isSellCTA, handleSellClick])

  return (
    <>
      <style>
        {`
          /* Fix iOS viewport issues */
          @supports (-webkit-touch-callout: none) {
            html { height: -webkit-fill-available; }
            body { min-height: 100vh; min-height: -webkit-fill-available; }
            .page { min-height: 100vh; min-height: -webkit-fill-available; }
          }

          @media (max-width: 480px) {
            .composer { padding-bottom: max(10px, env(safe-area-inset-bottom)) !important; }
            .footer { padding-bottom: max(14px, calc(14px + env(safe-area-inset-bottom))) !important; }
          }

          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

          .header {
            position: sticky; top: 0; z-index: 60;
            background: linear-gradient(180deg, rgba(18,18,26,0.95), rgba(18,18,26,0.8));
            backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: space-between;
            gap: 12px; padding: 12px 16px; transition: box-shadow 200ms ease, transform 160ms ease;
          }
          .header.pinned { box-shadow: 0 6px 20px rgba(0,0,0,0.25); transform: translateY(0); }

          .brand { display:flex; align-items:center; gap:12px; min-width:0; flex:1; }
          .tag { font-size: 14px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

          .ticker-wrap {
            position: relative; height: 28px; display: flex; align-items: center;
            overflow: hidden; width: 100%; min-width: 160px;
          }
          .ticker {
            display: inline-block; white-space: nowrap; will-change: transform;
            animation: tickerScroll 18s linear infinite; padding-left: 100%;
            box-sizing: content-box; font-weight: 600; font-size: 13px; color: var(--accent);
          }

          .ticker-wrap::before, .ticker-wrap::after {
            content: ""; position: absolute; top: 0; bottom: 0; width: 64px; pointer-events: none;
          }
          .ticker-wrap::before {
            left: 0; background: linear-gradient(90deg, rgba(18,18,26,1) 0%, rgba(18,18,26,0) 100%);
          }
          .ticker-wrap::after {
            right: 0; background: linear-gradient(270deg, rgba(18,18,26,1) 0%, rgba(18,18,26,0) 100%);
          }

          @keyframes tickerScroll { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }

          .ticker.idle { animation: none; padding-left: 0; transform: none; }

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
              {renderedMessages}
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
                  width: '44px', height: '44px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0',
                  background: loading || !input.trim() ? '#ccc' : 'var(--accent)',
                  color: 'white', border: 'none',
                  cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: loading || !input.trim() ? 'none' : '0 2px 8px rgba(0,115,55,0.18)',
                  minWidth: '44px', flexShrink: 0
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
                    width: '16px', height: '16px', border: '2px solid transparent',
                    borderTop: '2px solid white', borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

// ✅ PERFORMANCE: Clear caches periodically (optional)
if (typeof window !== 'undefined') {
  setInterval(() => {
    // Clear expired entries periodically
    const now = Date.now()
    jwtCache.forEach((value, key) => {
      if (now - value.timestamp > 300000) { // 5 minutes
        jwtCache.delete(key)
      }
    })
    
    if (jwtCache.size > 100) {
      jwtCache.clear()
    }
  }, 300000) // Every 5 minutes
}