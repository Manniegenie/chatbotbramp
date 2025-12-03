// src/MobileApp.tsx
import React, { useEffect, useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { tokenStore } from './lib/secureStore'
import { authFetch, getAuthState, setupAutoLogoutTimer, clearAuth } from './lib/tokenManager'
import { useInactivityTimer } from './lib/useInactivityTimer'
import MobileSignIn, { SignInResult } from './MobileSignIn'
import MobileSignUp, { SignUpResult } from './MobileSignUp'
import MobileSell from './MobileSell'
import MobileGame from './MobileGame'
import MobileVoiceChat from './MobileVoiceChat'
import MobileLiskWallet from './MobileLiskWallet'
import BrampLogo from './assets/logo.jpeg'
import micIcon from './assets/mic.png'
import { Bitcoin, EthereumCircleFlat, Usdt, Usdc, Send } from './components/CryptoIcons'
import wallpaper2 from './assets/wallpaper2.jpg'
import Preloader from './Preloader'
import { MessageCircleIcon } from 'lucide-react'
import './MobileApp.css'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'

// --- Types & Interfaces ---
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

interface NewsCard {
  id: string
  title: string
  description: string
  date: string
  source: string
  url?: string
}

// --- NEW COMPONENT: SCATTERED COINS ---
const BackgroundCoins = React.memo(() => {
  // Generate 30 random coins only once
  const coins = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      top: Math.random() * 100, // 0-100%
      left: Math.random() * 100, // 0-100%
      // INCREASED SIZE: Randomly between 40px and 80px
      size: 40 + Math.random() * 40, 
      duration: 5 + Math.random() * 15, // 5s to 20s rotation speed
      delay: -(Math.random() * 10), // Negative delay to start mid-animation
      opacity: 0.2 + Math.random() * 0.5 // Random opacity for depth
    }))
  }, [])

  return (
    <div className="bg-coin-container">
      {coins.map((coin) => (
        <div 
          key={coin.id} 
          className="bg-coin"
          style={{
            top: `${coin.top}%`,
            left: `${coin.left}%`,
            fontSize: `${coin.size}px`, // This scales the em units in CSS
            opacity: coin.opacity,
            animationDuration: `${coin.duration}s`,
            animationDelay: `${coin.delay}s`
          } as React.CSSProperties}
        >
          <div className="side heads">
            <svg xmlns="http://www.w3.org/2000/svg" xmlSpace="preserve" width="100%" height="100%" version="1.1" shapeRendering="geometricPrecision" textRendering="geometricPrecision" imageRendering="optimizeQuality" fillRule="evenodd" clipRule="evenodd" viewBox="0 0 4091.27 4091.73" xmlnsXlink="http://www.w3.org/1999/xlink">
              <g>
                <path fill="#F7931A" fillRule="nonzero" d="M4030.06 2540.77c-273.24,1096.01 -1383.32,1763.02 -2479.46,1489.71 -1095.68,-273.24 -1762.69,-1383.39 -1489.33,-2479.31 273.12,-1096.13 1383.2,-1763.19 2479,-1489.95 1096.06,273.24 1763.03,1383.51 1489.76,2479.57l0.02 -0.02z"></path>
                <path fill="white" fillRule="nonzero" d="M2947.77 1754.38c40.72,-272.26 -166.56,-418.61 -450,-516.24l91.95 -368.8 -224.5 -55.94 -89.51 359.09c-59.02,-14.72 -119.63,-28.59 -179.87,-42.34l90.16 -361.46 -224.36 -55.94 -92 368.68c-48.84,-11.12 -96.81,-22.11 -143.35,-33.69l0.26 -1.16 -309.59 -77.31 -59.72 239.78c0,0 166.56,38.18 163.05,40.53 90.91,22.69 107.35,82.87 104.62,130.57l-104.74 420.15c6.26,1.59 14.38,3.89 23.34,7.49 -7.49,-1.86 -15.46,-3.89 -23.73,-5.87l-146.81 588.57c-11.11,27.62 -39.31,69.07 -102.87,53.33 2.25,3.26 -163.17,-40.72 -163.17,-40.72l-111.46 256.98 292.15 72.83c54.35,13.63 107.61,27.89 160.06,41.3l-92.9 373.03 224.24 55.94 92 -369.07c61.26,16.63 120.71,31.97 178.91,46.43l-91.69 367.33 224.51 55.94 92.89 -372.33c382.82,72.45 670.67,43.24 791.83,-303.02 97.63,-278.78 -4.86,-439.58 -206.26,-544.44 146.69,-33.83 257.18,-130.31 286.64,-329.61l-0.07 -0.05zm-512.93 719.26c-69.38,278.78 -538.76,128.08 -690.94,90.29l123.28 -494.2c152.17,37.99 640.17,113.17 567.67,403.91zm69.43 -723.3c-63.29,253.58 -453.96,124.75 -580.69,93.16l111.77 -448.21c126.73,31.59 534.85,90.55 468.94,355.05l-0.02 0z"></path>
              </g>
            </svg>
          </div>
          <div className="side tails">
            <svg xmlns="http://www.w3.org/2000/svg" className="svg_back" xmlSpace="preserve" width="100%" height="100%" version="1.1" shapeRendering="geometricPrecision" textRendering="geometricPrecision" imageRendering="optimizeQuality" fillRule="evenodd" clipRule="evenodd" viewBox="0 0 4091.27 4091.73" xmlnsXlink="http://www.w3.org/1999/xlink">
              <g>
                <path fill="#F7931A" fillRule="nonzero" d="M4030.06 2540.77c-273.24,1096.01 -1383.32,1763.02 -2479.46,1489.71 -1095.68,-273.24 -1762.69,-1383.39 -1489.33,-2479.31 273.12,-1096.13 1383.2,-1763.19 2479,-1489.95 1096.06,273.24 1763.03,1383.51 1489.76,2479.57l0.02 -0.02z"></path>
                <path fill="white" fillRule="nonzero" d="M2947.77 1754.38c40.72,-272.26 -166.56,-418.61 -450,-516.24l91.95 -368.8 -224.5 -55.94 -89.51 359.09c-59.02,-14.72 -119.63,-28.59 -179.87,-42.34l90.16 -361.46 -224.36 -55.94 -92 368.68c-48.84,-11.12 -96.81,-22.11 -143.35,-33.69l0.26 -1.16 -309.59 -77.31 -59.72 239.78c0,0 166.56,38.18 163.05,40.53 90.91,22.69 107.35,82.87 104.62,130.57l-104.74 420.15c6.26,1.59 14.38,3.89 23.34,7.49 -7.49,-1.86 -15.46,-3.89 -23.73,-5.87l-146.81 588.57c-11.11,27.62 -39.31,69.07 -102.87,53.33 2.25,3.26 -163.17,-40.72 -163.17,-40.72l-111.46 256.98 292.15 72.83c54.35,13.63 107.61,27.89 160.06,41.3l-92.9 373.03 224.24 55.94 92 -369.07c61.26,16.63 120.71,31.97 178.91,46.43l-91.69 367.33 224.51 55.94 92.89 -372.33c382.82,72.45 670.67,43.24 791.83,-303.02 97.63,-278.78 -4.86,-439.58 -206.26,-544.44 146.69,-33.83 257.18,-130.31 286.64,-329.61l-0.07 -0.05zm-512.93 719.26c-69.38,278.78 -538.76,128.08 -690.94,90.29l123.28 -494.2c152.17,37.99 640.17,113.17 567.67,403.91zm69.43 -723.3c-63.29,253.58 -453.96,124.75 -580.69,93.16l111.77 -448.21c126.73,31.59 534.85,90.55 468.94,355.05l-0.02 0z"></path>
              </g>
            </svg>
          </div>
        </div>
      ))}
    </div>
  )
})

// --- Helper Components ---
function MobileNewsSection() {
  const [newsCards, setNewsCards] = useState<NewsCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    let isMounted = true

    async function fetchNews() {
      try {
        const resp = await fetch(`${API_BASE}/news/news?limit=6`, { signal: controller.signal })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        if (isMounted && data?.success && Array.isArray(data.data)) {
          setNewsCards(data.data)
        }
      } catch (err) {
        console.error('Failed to fetch news:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchNews()
    return () => {
      isMounted = false
      controller.abort()
    }
  }, [])

  const handleCardClick = (card: NewsCard) => {
    if (card.url) window.open(card.url, '_blank', 'noopener,noreferrer')
  }

  if (loading) return <div className="mobile-news-loading">Loading news…</div>

  return (
    <section className="mobile-news-section">
      <h2 className="mobile-news-header">Latest</h2>
      <div className="mobile-news-cards-container">
        {newsCards.map((card) => (
          <article
            key={card.id}
            className="mobile-news-card"
            onClick={() => handleCardClick(card)}
            role="button"
            tabIndex={0}
          >
            <div className="mobile-news-card-dots">
              <div className="mobile-news-card-dot"></div>
              <div className="mobile-news-card-dot"></div>
              <div className="mobile-news-card-dot"></div>
            </div>
            <div className="mobile-news-card-content">
              <h3 className="mobile-news-card-title">{card.title}</h3>
              <p className="mobile-news-card-description">{card.description}</p>
              <div className="mobile-news-card-meta">
                <span className="mobile-news-card-date">{card.date}</span>
                <span className="mobile-news-card-source">{card.source}</span>
              </div>
            </div>
            <button className="mobile-news-card-button">
              <span className="mobile-news-card-button-text">Explore Now</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                className="mobile-news-card-button-icon"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                />
              </svg>
            </button>
            <div className="mobile-news-card-blur"></div>
          </article>
        ))}
      </div>
    </section>
  )
}

function ThreeDotLoader() {
  return (
    <div className="typing-mobile">
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <div className="dot"></div>
        <div className="dot" style={{ animationDelay: '-0.16s' }}></div>
        <div className="dot" style={{ animationDelay: '0s' }}></div>
      </div>
    </div>
  )
}

// --- Utilities ---
function getSessionId(): string {
  const key = 'bramp__session_id'
  let sid = localStorage.getItem(key)
  if (!sid) {
    sid = crypto.randomUUID()
    localStorage.setItem(key, sid)
  }
  return sid
}

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  else if (hour < 18) return 'Good afternoon'
  else return 'Good evening'
}

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}

async function sendChatMessage(message: string, history: ChatMessage[]): Promise<{ reply: string; cta?: CTA | null; metadata?: any; browsing?: boolean }> {
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
  if (data.browsing) {
    return {
      reply: data?.reply ?? 'Gathering information...',
      cta: data.cta || null,
      metadata: data.metadata,
      browsing: true
    }
  }

  return {
    reply: data?.reply ?? 'Sorry, I could not process that.',
    cta: data.cta || null,
    metadata: data.metadata,
  }
}

async function pollBrowsingResult(sessionId: string): Promise<{ reply: string; completed: boolean }> {
  const response = await authFetch(`${API_BASE}/chatbot/chat/browsing/${sessionId}`, {
    method: 'GET',
    mode: 'cors',
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()
  return {
    reply: data?.reply ?? 'Still processing...',
    completed: data?.completed ?? false
  }
}

// --- Main Component ---
export default function MobileApp() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [showPreloader, setShowPreloader] = useState(true)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCenteredInput, setShowCenteredInput] = useState(true)
  const [showSignIn, setShowSignIn] = useState(false)
  const [hideSignUpButton, setHideSignUpButton] = useState(false)
  const [showSignUp, setShowSignUp] = useState(false)
  const [showSell, setShowSell] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [openSellAfterAuth, setOpenSellAfterAuth] = useState(false)
  const [shouldOpenSell, setShouldOpenSell] = useState(false)
  const [showGame, setShowGame] = useState(false)
  const [showVoiceChat, setShowVoiceChat] = useState(false)
  const [showLiskWallet, setShowLiskWallet] = useState(false)
  const [showHints, setShowHints] = useState(false)

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
  const [tickerText, setTickerText] = useState<string>('')

  const icons = [
    { component: Usdt, name: 'USDT' },
  ]
  const [currentIconIndex, setCurrentIconIndex] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setShowPreloader(false), 3000)
    return () => window.clearTimeout(timer)
  }, [])

  const overlayActive = showSignIn || showSignUp || showSell || showVoiceChat || showMenu || showLiskWallet
  const pageClassName = overlayActive ? 'mobile-page mobile-page--overlay' : 'mobile-page'
  const pageOverlayStyle: React.CSSProperties | undefined = showPreloader
    ? { opacity: 0, pointerEvents: 'none' }
    : undefined

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIconIndex((prev) => (prev + 1) % icons.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [icons.length])

  useEffect(() => {
    if (shouldOpenSell && !showSell) {
      handleSellClick()
      setShouldOpenSell(false)
    }
  }, [shouldOpenSell, showSell, auth])

  function parseBoldText(text: string): string {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
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
              const cleanText = l.trim().slice(2)
              return (
                <li key={li} style={{ margin: '4px 0' }}>
                  <span dangerouslySetInnerHTML={{ __html: parseBoldText(cleanText) }} />
                </li>
              )
            })}
          </ul>
        )
      } else {
        rendered.push(
          <p key={`p-${pi}`} style={{ margin: '8px 0' }}>
            {lines.map((line, li) => (
              <React.Fragment key={li}>
                <span dangerouslySetInnerHTML={{ __html: parseBoldText(line) }} />
                {li < lines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
        )
      }
    })

    return rendered
  }

  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      let changed = false
      for (const p of ['user_id', 'token', 'code']) {
        if (url.searchParams.has(p)) {
          url.searchParams.delete(p)
          changed = true
        }
      }
      if (changed) {
        const clean =
          url.pathname +
          (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') +
          url.hash
        window.history.replaceState({}, '', clean)
      }
    } catch { }

    const cleanup = setupAutoLogoutTimer((reason) => {
      console.log('Auto-logout triggered:', reason)
      setAuth(null)
      setShowSell(false)
      setShowMenu(false)
      setShowSignIn(false)
      setShowSignUp(false)
      setOpenSellAfterAuth(false)
      setShowCenteredInput(true)
      setMessages([])

      if (typeof window !== 'undefined' && window.navigator?.userAgent?.includes('iPhone')) {
        setTimeout(() => {
          document.body.style.transform = 'translateZ(0)'
          setTimeout(() => {
            document.body.style.transform = ''
          }, 100)
        }, 100)
      }
    })

    return cleanup
  }, [])

  useInactivityTimer({
    timeout: 45 * 60 * 1000,
    onInactive: () => {
      console.log('45 minutes of inactivity detected, returning to centered input')
      setShowCenteredInput(true)
      setMessages([])
    }
  })

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, loading])

  const TICKER_SYMBOLS = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'NGNB']
  async function fetchTickerPrices(signal?: AbortSignal) {
    try {
      const symbolParam = TICKER_SYMBOLS.join(',')
      const url = `${API_BASE}/prices/prices?symbols=${encodeURIComponent(symbolParam)}&changes=true&limit=9`
      const resp = await authFetch(url, { method: 'GET', signal })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)

      const payload = await resp.json()
      if (!payload?.success || !payload?.data) return

      const { prices = {}, hourlyChanges = {} } = payload.data
      const items = TICKER_SYMBOLS.filter(
        (s) => s === 'NGNB' || typeof prices[s] === 'number'
      ).map((s) => {
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
        const changeText =
          changePct != null ? ` ${changePct > 0 ? '+' : ''}${Number(changePct).toFixed(1)}%` : ''
        const usdStr =
          usd >= 1
            ? usd.toLocaleString(undefined, { maximumFractionDigits: 2 })
            : usd.toFixed(4).replace(/\.?0+$/, '')
        return `${s} $${usdStr}${changeText}`
      })
      const text = items.join('  •  ')
      if (text) setTickerText(text)
    } catch (err) {
      console.warn('Ticker fetch failed', err)
    }
  }

  useEffect(() => {
    const ac = new AbortController()
    fetchTickerPrices(ac.signal).catch(() => { })
    return () => ac.abort()
  }, [])

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || loading) return

    if (showCenteredInput) {
      setShowCenteredInput(false)
      setHideSignUpButton(true)
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: trimmed,
      ts: Date.now(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setTimeout(() => inputRef.current?.focus(), 0)

    let browsingData: { browsing?: boolean } | null = null
    let pollInterval: number | null = null

    try {
      const data = await sendChatMessage(trimmed, [...messages, userMsg])
      browsingData = data
      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: data.reply,
        ts: Date.now(),
        cta: data.cta || null,
      }

      const hasSellIntent = data.cta?.buttons?.some(btn => isSellCTA(btn))
      if (hasSellIntent) {
        setShouldOpenSell(true)
        setLoading(false)
      } else {
        setMessages((prev) => [...prev, aiMsg])

        if (data.browsing) {
          const sessionId = getSessionId()
          const maxAttempts = 60
          let attempts = 0

          pollInterval = setInterval(async () => {
            attempts++
            try {
              const browsingResult = await pollBrowsingResult(sessionId)
              if (browsingResult.completed) {
                if (pollInterval) clearInterval(pollInterval)
                setMessages((prev) => {
                  const updated = [...prev]
                  const idx = updated.findIndex(m => m.id === aiMsg.id)
                  if (idx !== -1) updated[idx] = { ...updated[idx], text: browsingResult.reply }
                  return updated
                })
                setLoading(false)
              } else if (attempts >= maxAttempts) {
                if (pollInterval) clearInterval(pollInterval)
                setLoading(false)
              }
            } catch (pollError) {
              console.error('Polling failed:', pollError)
              if (attempts >= maxAttempts) {
                if (pollInterval) clearInterval(pollInterval)
                setLoading(false)
              }
            }
          }, 3000)
        } else {
          setLoading(false)
        }
      }
    } catch (error) {
      console.error('Chat message failed:', error)
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: `Error: ${getErrorMessage(error)}`,
        ts: Date.now(),
      }
      setMessages((prev) => [...prev, errorMsg])
      setLoading(false)
    } finally {
      if (!browsingData?.browsing) {
        setLoading(false)
      }
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  function signOut() {
    clearAuth()
    setAuth(null)
    setShowSell(false)
    setShowMenu(false)
    setMessages([])
    setShowCenteredInput(true)
  }

  function isSellCTA(btn: CTAButton): boolean {
    if (!btn) return false
    if (btn.id === 'start_sell') return true
    const url = String(btn.url || '').toLowerCase()
    return /\/sell($|\/|\?|#)|chatbramp\.com\/sell|localhost.*\/sell|sell\.html?$|\bsell\b/.test(url)
  }

  function handleSellClick(event?: React.MouseEvent) {
    event?.preventDefault()
    setShowMenu(false)
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
    setShowMenu(false)
    console.log('KYC button clicked - functionality disabled')
  }

  function handleGameClick(event?: React.MouseEvent) {
    event?.preventDefault()
    setShowMenu(false)
    setShowGame(true)
  }

  function handleLiskWalletClick(event?: React.MouseEvent) {
    event?.preventDefault()
    setShowMenu(false)
    // TEMPORARILY DISABLES FUNCTIONALITY
    console.log('Wallet button clicked - functionality temporarily disabled')
    // if (!auth) {
    //   setShowSignIn(true)
    //   return
    // }
    // setShowLiskWallet(true)
  }
  
  // RESTORED: Handler to toggle menu functionality
  function handleMenuClick(event?: React.MouseEvent) {
    event?.preventDefault()
    setShowMenu(!showMenu)
  }

  function echoFromModalToChat(text: string) {
    if (!text) return
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'assistant', text, ts: Date.now() },
    ])
  }

  function handleHintClick(hintText: string) {
    if (!loading) {
      if (showCenteredInput) {
        setShowCenteredInput(false)
      }
      setInput(hintText)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  const renderMainContent = () => {
    if (showSignIn) {
      return (
        <MobileSignIn
          onCancel={() => {
            setShowSignIn(false)
            setOpenSellAfterAuth(false)
          }}
          onSuccess={(res: SignInResult) => {
            setAuth(res)
            setShowSignIn(false)
            setShowCenteredInput(false)
            const greeting = getTimeBasedGreeting()
            const name = res.user.username || (res.user as any).firstname || 'there'
            setMessages([
              {
                id: crypto.randomUUID(),
                role: 'assistant',
                text: `${greeting}, ${name}! How can I help you today?`,
                ts: Date.now(),
              },
            ])
            if (openSellAfterAuth) {
              setOpenSellAfterAuth(false)
              setShowSell(true)
            }
            if (typeof window !== 'undefined' && window.fbq) {
              window.fbq('track', 'CompleteRegistration', { value: 1, currency: 'USD' })
            }
          }}
        />
      )
    }

    if (showSignUp) {
      return (
        <MobileSignUp
          onCancel={() => setShowSignUp(false)}
          onSuccess={(_res: SignUpResult) => {
            setShowSignUp(false)
            setShowCenteredInput(false)
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: 'assistant',
                text: 'Account created! Please verify your OTP to complete signup.',
                ts: Date.now(),
              },
            ])
            if (typeof window !== 'undefined' && window.fbq) {
              window.fbq('track', 'CompleteRegistration', { value: 1, currency: 'USD' })
            }
            setShowSignIn(true)
          }}
        />
      )
    }

    return (
      <main className="mobile-chat">
        <div className="mobile-messages">
          {messages.map((m) => (
            <div key={m.id} className={`mobile-bubble ${m.role}`}>
              <div className="mobile-bubble-content">
                {renderMessageText(m.text)}
                {m.role === 'assistant' &&
                  m.cta?.type === 'button' &&
                  m.cta.buttons?.length > 0 && (
                    <div className="mobile-cta-buttons">
                      {m.cta.buttons.map((btn, index) => (
                        <a
                          key={btn.id || btn.title || index}
                          className="mobile-cta-btn"
                          href={btn.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {btn.title}
                        </a>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          ))}
          {loading && <ThreeDotLoader />}
          <div ref={endRef} />
        </div>

        {showCenteredInput ? (
          <div className="mobile-dashboard-container"
            style={{
              position: 'absolute',
              top: '10px',
              bottom: '60px',
              left: 0,
              right: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              paddingTop: '0px',
              overflow: 'hidden'
            }}
          >
            <div className="mobile-centered-input" style={{ position: 'relative', top: 'auto', left: 'auto', transform: 'none', marginBottom: '20px', flexShrink: 0 }}>
              <div className="mobile-centered-form">
                <h2 style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}>Secure Crypto to NGN Exchange</h2>

                <div style={{ height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <div className="credit-card-chip-container" style={{ flexShrink: 0, height: '40px', width: '40px' }}>
                    <svg xmlSpace="preserve" viewBox="0 0 511 511" xmlnsXlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg" id="Capa_1" version="1.1" width="800px" height="800px" fill="#d4af37" className="chip">
                      <path d="M455.5,56h-400C24.897,56,0,80.897,0,111.5v288C0,430.103,24.897,455,55.5,455h400c30.603,0,55.5-24.897,55.5-55.5v-288
  C511,80.897,486.103,56,455.5,56z M464,248H343v-56.5c0-4.687,3.813-8.5,8.5-8.5H464V248z M343,263h121v65H343V263z M479,223h17v65
  h-17V223z M479,208v-65h17v65H479z M464,168H351.5c-12.958,0-23.5,10.542-23.5,23.5V408H183V103h272.5c4.687,0,8.5,3.813,8.5,8.5
  V168z M168,248H47v-65h121V248z M32,288H15v-65h17V288z M47,263h121v65H47V263z M263,88V71h137v17H263z M248,88H111V71h137V88z
   M168,103v65H47v-56.5c0-4.687,3.813-8.5,8.5-8.5H168z M32,208H15v-65h17V208z M15,303h17v65H15V303z M47,343h121v65H55.5
  c-4.687,0-8.5-3.813-8.5-8.5V343z M248,423v17H111v-17H248z M263,423h137v17H263V423z M343,408v-65h121v56.5
  c0,4.687-3.813,8.5-8.5,8.5H343z M479,303h17v65h-17V303z M496,111.5V128h-17v-16.5c0-12.958-10.542-23.5-23.5-23.5H415V71h40.5
  C477.832,71,496,89.168,496,111.5z M55.5,71H96v17H55.5C42.542,88,32,98.542,32,111.5V128H15v-16.5C15,89.168,33.168,71,55.5,71z
   M15,399.5V383h17v16.5c0,12.958,10.542,23.5,23.5,23.5H96v17H55.5C33.168,440,15,421.832,15,399.5z M455.5,440H415v-17h40.5
  c12.958,0,23.5-10.542,23.5-23.5V383h17v16.5C496,421.832,477.832,440,455.5,440z"></path>
                    </svg>
                  </div>
                  
                  
                  
                  
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentIconIndex}
                      className="mobile-app-logo"
                      initial={{ opacity: 0, scale: 0.8, rotateY: -90 }}
                      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                      exit={{ opacity: 0, scale: 0.8, rotateY: 90 }}
                      transition={{ duration: 0.6, type: "spring", stiffness: 100, damping: 15 }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {React.createElement(icons[currentIconIndex].component, { size: 62 })}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <form style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center', position: 'relative' }} onSubmit={sendMessage}>
                  
                  
                  <div className="mobile-input-shell">
                    <div className="mobile-input-gradient-box" style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                      <input
                        ref={inputRef}
                        className="mobile-input mobile-input-centered mobile-input-with-send"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Try: Pay 100 USDT to John"
                        disabled={loading}
                        style={{ paddingRight: '56px', width: '100%' }}
                      />
                      <button
                        type="submit"
                        className="mobile-send-btn mobile-send-btn-inside"
                        disabled={loading || !input.trim()}
                        aria-label="Send message"
                      >
                        {loading ? <div className="mobile-spinner" /> : <Send size={20} active={Boolean(input.trim())} />}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            <div style={{ width: '100%', maxWidth: '100%', flex: 1, overflow: 'hidden', paddingBottom: '5px', minHeight: 0 }}>
              <MobileNewsSection />
            </div>
          </div>
        ) : (
                  <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px 12px' }}>
              <button
                type="button"
                className="mobile-send-btn mobile-hint-toggle-btn"
                onClick={() => setShowHints(!showHints)}
                disabled={loading}
                aria-label="Show hints"
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(0, 0, 0, 0.15)',
                  padding: '8px',
                  minWidth: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <MessageCircleIcon size={24} stroke={showHints ? '#007337' : 'rgba(0, 0, 0, 0.5)'} />
              </button>
            </div>
            {showHints && (
              <div className="mobile-hints">
                <button className="mobile-hint" onClick={() => handleHintClick('Sell 100 USDT to NGN')}>Sell USDT</button>
                <button className="mobile-hint" onClick={() => handleHintClick('Show my portfolio balance')}>Portfolio</button>
                <button className="mobile-hint" onClick={() => handleHintClick('Current NGN rates')}>NGN Rates</button>
              </div>
            )}

            <form className="mobile-composer" onSubmit={sendMessage}>
              <div className="mobile-input-shell">
                <input
                  ref={inputRef}
                  className="mobile-input mobile-input-with-send"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={loading ? 'Please wait…' : 'Chat Bramp AI...'}
                  disabled={loading}
                />
                <button
                  type="submit"
                  className="mobile-send-btn mobile-send-btn-inside"
                  disabled={loading || !input.trim()}
                  aria-label="Send message"
                >
                  {loading ? (
                    <div className="mobile-spinner" />
                  ) : (
                    <Send size={20} active={Boolean(input.trim())} style={{ opacity: loading || !input.trim() ? 0.6 : 1, color: input.trim() ? undefined : 'rgba(0, 0, 0, 0.5)' }} />
                  )}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="mobile-send-btn"
                  onClick={() => setShowVoiceChat(true)}
                  disabled={true} /* TEMPORARILY DISABLED */
                  aria-label="Voice chat (Disabled)"
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '8px',
                    minWidth: '44px',
                    height: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <img src={micIcon} alt="Mic" style={{ width: '24px', height: '24px' }} />
                </button>
              </div>
            </form>
          </>
        )}
      </main>
    )
  }

  if (showGame) {
    return (
      <div className={pageClassName} style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', '--wallpaper-image': `url(${wallpaper2})` } as React.CSSProperties}>
        <MobileGame onClose={() => setShowGame(false)} />
      </div>
    )
  }

  if (showLiskWallet) {
    return (
      <div className={pageClassName} style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', '--wallpaper-image': `url(${wallpaper2})` } as React.CSSProperties}>
        <MobileLiskWallet onClose={() => setShowLiskWallet(false)} />
      </div>
    )
  }

  if (showVoiceChat) {
    return (
      <div className={pageClassName} style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', '--wallpaper-image': `url(${wallpaper2})` } as React.CSSProperties}>
        <MobileVoiceChat
          onClose={() => setShowVoiceChat(false)}
          onMessage={(text) => { if (text) echoFromModalToChat(text) }}
          onSellIntent={() => {
            setShowVoiceChat(false)
            setShowSell(true)
          }}
        />
      </div>
    )
  }

  if (showSell) {
    return (
      <div className={pageClassName} style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', '--wallpaper-image': `url(${wallpaper2})` } as React.CSSProperties}>
        <MobileSell
          open={showSell}
          onClose={() => setShowSell(false)}
          onChatEcho={echoFromModalToChat}
          onStartInteraction={() => setShowCenteredInput(false)}
        />
      </div>
    )
  }

  if (showSignIn || showSignUp) {
    return (
      <div className={pageClassName} style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', '--wallpaper-image': `url(${wallpaper2})` } as React.CSSProperties}>
        {renderMainContent()}
      </div>
    )
  }

  return (
    <>
      {showPreloader && <Preloader />}

      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="sign-in-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A80077" />
            <stop offset="100%" stopColor="#66FF00" />
          </linearGradient>
          <linearGradient id="sign-in-gradient-animated" x1="0%" y1="0%" x2="100%" y2="100%" spreadMethod="repeat">
            <stop offset="0%" stopColor="#A80077">
              <animate attributeName="stop-color" values="#A80077;#66FF00;#A80077" dur="3s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#66FF00">
              <animate attributeName="stop-color" values="#66FF00;#A80077;#66FF00" dur="3s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
        </defs>
      </svg>

      <div
        className={`${pageClassName} ${messages.length > 0 ? 'mobile-page--chat-active' : ''}`}
        style={{ ...pageOverlayStyle, '--wallpaper-image': `url(${wallpaper2})` } as React.CSSProperties}
      >
        {/* === COINS PLACED INSIDE WRAPPER === */}
        <BackgroundCoins />
        
        <header className="mobile-header">
          <div className="mobile-header-top">
            <div className="mobile-brand">
              <img src={BrampLogo} alt="Bramp" className="mobile-logo" onError={(e) => { e.currentTarget.style.display = 'none' }} />
            </div>

            <div className="mobile-nav-buttons">
              {!auth ? (
                <div className="mobile-auth-buttons">
                  {/* SWITCH REMAINS HERE FOR UN-AUTHENTICATED VIEW */}
                  <label className="switch">
                    <input type="checkbox" onChange={(e) => console.log('Night mode:', e.target.checked)} />
                    <span className="slider"></span>
                  </label>
                  <button className="mobile-auth-btn mobile-login-btn" onClick={() => setShowSignIn(true)}>
                    Log In <span className="arrow">›</span>
                  </button>
                  {!hideSignUpButton && (
                    <button className="mobile-auth-btn mobile-create-account-btn" onClick={() => setShowSignUp(true)}>
                      Get Started
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* ADDED SWITCH HERE FOR AUTHENTICATED VIEW */}
                  <label className="switch" style={{ marginRight: '8px' }}>
                    <input type="checkbox" onChange={(e) => console.log('Night mode:', e.target.checked)} />
                    <span className="slider"></span>
                  </label>
                  <button className="btn mobile-sell-btn mobile-sell-btn-with-icon" onClick={handleSellClick} aria-label="Sell Crypto">
                    <span>Sell</span>
                  </button>
                  {/* RE-ADDED WALLET BUTTON */}
                  <button className="btn mobile-sell-btn mobile-wallet-btn" onClick={handleLiskWalletClick} style={{ marginLeft: '8px' }} aria-label="Connect Wallet">
                    Wallet
                  </button>
                  {/* RESTORED: Menu button functionality */}
                  <button className="mobile-menu-btn" onClick={handleMenuClick} aria-label="Toggle Menu">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <line x1="3" y1="12" x2="21" y2="12"></line>
                      <line x1="3" y1="6" x2="21" y2="6"></line>
                      <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {showMenu && auth && (
          <div className="mobile-menu-overlay" onClick={() => setShowMenu(false)}>
            <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
              <button className="mobile-menu-item" onClick={handleKycClick}>KYC</button>
              <button className="mobile-menu-item primary" onClick={handleSellClick}>Sell Crypto</button>
              <button className="mobile-menu-item" onClick={handleGameClick}>Game</button>
              <button className="mobile-menu-item" onClick={handleLiskWalletClick}>Connect Wallet</button>
              <button className="mobile-menu-item" onClick={signOut}>Sign Out</button>
              <div className="mobile-menu-divider"></div>
              <a className="mobile-menu-item" href="https://drive.google.com/file/d/11qmXGhossotfF4MTfVaUPac-UjJgV42L/view" target="_blank" rel="noopener noreferrer">AML/CFT Policy</a>
              <a className="mobile-menu-item" href="https://drive.google.com/file/d/1brtkc1Tz28Lk3Xb7C0t3--wW7829Txxw/view" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
              <a className="mobile-menu-item" href="https://www.instagram.com/chatbramp/" target="_blank" rel="noopener noreferrer">Instagram</a>
            </div>
          </div>
        )}

        {renderMainContent()}

        {!auth && showCenteredInput && (
          <footer className="mobile-footer">
            <div className="mobile-footer-links-bottom">
              <a href="https://drive.google.com/file/d/11qmXGhossotfF4MTfVaUPac-UjJgV42L/view?usp=drive_link" target="_blank" rel="noopener noreferrer">AML/CFT Policy</a>
              <a href="https://drive.google.com/file/d/1brtkc1Tz28Lk3Xb7C0t3--wW7829Txxw/view?usp=drive_link" target="_blank" rel="noopener noreferrer" className="footer-privacy-link">Privacy</a>
              <a href="https://www.instagram.com/chatbramp/" target="_blank" rel="noopener noreferrer">Instagram</a>
              <a href="https://www.youtube.com/@Chatbramp" target="_blank" rel="noopener noreferrer">YouTube</a>
              <a href="https://x.com/Chatbramp" target="_blank" rel="noopener noreferrer">Twitter</a>
              <a href="https://medium.com/@chatbramp" target="_blank" rel="noopener noreferrer">Medium</a>
            </div>
          </footer>
        )}
      </div>
    </>
  )
}