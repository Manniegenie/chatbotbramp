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
import logoPng from './assets/logo.png'
import tronPng from './assets/tron.png'
import usdcPng from './assets/usdc.png'
import shibaPng from './assets/shiba-inu.png'
import { Bitcoin, EthereumCircleFlat, Usdt, Usdc, Send } from './components/CryptoIcons'
import SpinnerLoader from './components/SpinnerLoader'
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

// --- UPDATED COMPONENT: STATIC ICONS ---
const BackgroundCoins = React.memo(() => {
  return (
    <div className="bg-coin-container static-coins">
      {/* BITCOIN ICON */}
      <div className="static-coin bitcoin-pos">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 96 96" width="100%" height="100%">
          <desc>Bitcoin Streamline Icon: https://streamlinehq.com</desc>
          <path fill="url(#btc_grad)" d="M93.5941 59.3659C87.3143 84.5581 61.791 99.8717 36.6349 93.592 11.4422 87.3123-3.87179 61.7896 2.40804 36.6341 8.68787 11.4419 34.1744-3.87168 59.3672 2.40801 84.5232 8.65097 99.8739 34.1737 93.5941 59.3659Z" />
          <path fill="#ffffff" d="M70.3781 42.1432c.918-6.2422-3.8187-9.6203-10.3547-11.8602l2.1297-8.482-5.1406-1.2852-2.0563 8.2617c-1.3585-.3304-2.7539-.6609-4.1492-.9546l2.0563-8.2985-5.1406-1.2851-2.093 8.4453c-1.1383-.2571-2.2399-.5141-3.3047-.7711v-.0367l-7.1234-1.7625-1.3586 5.5078s3.8187.8812 3.7453.9179c2.0929.5141 2.4601 1.9094 2.3867 3.011l-2.4234 9.657c.1468.0367.3304.0734.5507.1836-.1836-.0367-.3671-.0734-.5507-.1469l-3.3782 13.5125c-.257.6243-.9179 1.5789-2.35 1.2117.0368.0735-3.7453-.9179-3.7453-.9179l-2.5703 5.9117 6.7195 1.6891c1.2485.3304 2.4602.6242 3.6719.9546l-2.1297 8.5555 5.1407 1.2852 2.1296-8.4821c1.3954.3672 2.7907.7344 4.1125 1.0649l-2.0929 8.4453L48.2 77.7604l2.1297-8.5555c8.8125 1.6523 15.4219.9914 18.1758-6.9766 2.2398-6.389-.1102-10.0976-4.7368-12.5211 3.4149-.7711 5.9485-3.0109 6.6094-7.564ZM58.5914 58.6666c-1.5789 6.3891-12.3742 2.9375-15.8625 2.0563l2.8274-11.3461c3.4882.8812 14.7242 2.607 13.0351 9.2898ZM60.207 42.033c-1.4687 5.8383-10.4281 2.8641-13.3289 2.1297l2.5703-10.2813c2.9008.7344 12.2641 2.093 10.7586 8.1516Z" />
          <defs>
            <linearGradient id="btc_grad" x1={4698.49} x2={4698.49} y1={-1.214} y2={9400.05} gradientUnits="userSpaceOnUse">
              <stop stopColor="#f9aa4b" />
              <stop offset={1} stopColor="#f7931a" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* ETHEREUM ICON */}
      <div className="static-coin eth-pos">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" width="100%" height="100%">
          <desc>Ethereum Streamline Icon: https://streamlinehq.com</desc>
          <path fill="#343434" d="m11.997875 0.25 -0.15755 0.5354925V16.324225l0.15755 0.15725 7.2129 -4.263525L11.997875 0.25Z" strokeWidth={0.25} />
          <path fill="#8c8c8c" d="M11.997825 0.25 4.7849 12.21795l7.212925 4.2636V0.25Z" strokeWidth={0.25} />
          <path fill="#3c3c3b" d="m11.99795 17.847175 -0.088775 0.108225v5.535225l0.088775 0.25935 7.2172 -10.1642 -7.2172 4.2614Z" strokeWidth={0.25} />
          <path fill="#8c8c8c" d="M11.997825 23.749925V17.8471L4.7849 13.585725l7.212925 10.1642Z" strokeWidth={0.25} />
          <path fill="#141414" d="M11.9978 16.481475 19.2106 12.218 11.9978 8.93955v7.541925Z" strokeWidth={0.25} />
          <path fill="#393939" d="m4.7849 12.218 7.2128 4.263475V8.93955L4.7849 12.218Z" strokeWidth={0.25} />
        </svg>
      </div>
    </div>
  )
})

// --- Helper Components ---
function MobileNewsSection() {
  const [newsCards, setNewsCards] = useState<NewsCard[]>([])
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

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

  // Auto-scroll carousel
  useEffect(() => {
    if (!containerRef.current || newsCards.length === 0) return

    const container = containerRef.current
    const maxScroll = container.scrollWidth - container.clientWidth
    if (maxScroll <= 0) return

    let direction = 1
    let isPaused = false
    let pauseTimeout: ReturnType<typeof setTimeout> | null = null

    // Pause auto-scroll when user interacts
    const handleUserInteraction = () => {
      isPaused = true
      if (pauseTimeout) clearTimeout(pauseTimeout)
      pauseTimeout = setTimeout(() => {
        isPaused = false
      }, 3000) // Resume after 3 seconds of no interaction
    }

    // Track active card based on scroll position
    const updateActiveIndex = () => {
      const cardWidth = 280 + 16 // card width + gap
      const scrollLeft = container.scrollLeft
      const newIndex = Math.round(scrollLeft / cardWidth)
      setActiveIndex(Math.min(newIndex, newsCards.length - 1))
    }

    container.addEventListener('scroll', () => {
      handleUserInteraction()
      updateActiveIndex()
    })
    container.addEventListener('touchstart', handleUserInteraction)
    container.addEventListener('mousedown', handleUserInteraction)
    
    // Initial update
    updateActiveIndex()

    const autoScroll = setInterval(() => {
      if (isPaused) return

      const currentScroll = container.scrollLeft
      const newScroll = currentScroll + direction * 0.5

      if (newScroll >= maxScroll) {
        direction = -1
        container.scrollTo({ left: maxScroll, behavior: 'auto' })
      } else if (newScroll <= 0) {
        direction = 1
        container.scrollTo({ left: 0, behavior: 'auto' })
      } else {
        container.scrollTo({ left: newScroll, behavior: 'auto' })
      }
    }, 20) // Smooth animation

    return () => {
      clearInterval(autoScroll)
      if (pauseTimeout) clearTimeout(pauseTimeout)
      container.removeEventListener('scroll', handleUserInteraction)
      container.removeEventListener('touchstart', handleUserInteraction)
      container.removeEventListener('mousedown', handleUserInteraction)
    }
  }, [newsCards])

  const handleCardClick = (card: NewsCard) => {
    if (card.url) window.open(card.url, '_blank', 'noopener,noreferrer')
  }

  const handleDotClick = (index: number) => {
    if (!containerRef.current) return
    const cardWidth = 280 + 16 // card width + gap
    containerRef.current.scrollTo({
      left: index * cardWidth,
      behavior: 'smooth'
    })
    setActiveIndex(index)
  }

  if (loading) {
    return (
      <div className="mobile-news-loading">
        <SpinnerLoader size="medium" variant="primary" />
        <span style={{ marginLeft: '12px', color: 'var(--txt)' }}>Loading news…</span>
      </div>
    )
  }

  return (
    <section className="mobile-news-section">
      <h2 className="mobile-news-header">Latest</h2>
      <div className="mobile-news-cards-container" ref={containerRef}>
        {newsCards.map((card) => (
          <article
            key={card.id}
            className="mobile-news-card"
            onClick={() => handleCardClick(card)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleCardClick(card)
              }
            }}
          >
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
      {newsCards.length > 0 && (
        <div className="mobile-news-dots">
          {newsCards.map((_, index) => (
            <button
              key={index}
              className={`mobile-news-dot ${index === activeIndex ? 'active' : ''}`}
              onClick={() => handleDotClick(index)}
              aria-label={`Go to card ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
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
  const [nightMode, setNightMode] = useState(true)

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
    { component: () => <img src={tronPng} alt="Tron" style={{ width: '62px', height: '62px', objectFit: 'contain' }} />, name: 'Tron' },
    { component: () => <img src={usdcPng} alt="USDC" style={{ width: '62px', height: '62px', objectFit: 'contain' }} />, name: 'USDC' },
    { component: () => <img src={shibaPng} alt="Shiba Inu" style={{ width: '62px', height: '62px', objectFit: 'contain' }} />, name: 'Shiba' },
  ]
  const [currentIconIndex, setCurrentIconIndex] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setShowPreloader(false), 3000)
    return () => window.clearTimeout(timer)
  }, [])

  // Toggle night-mode class on body and html
  useEffect(() => {
    if (nightMode) {
      document.body.classList.add('night-mode')
      document.documentElement.classList.add('night-mode')
    } else {
      document.body.classList.remove('night-mode')
      document.documentElement.classList.remove('night-mode')
    }
    return () => {
      document.body.classList.remove('night-mode')
      document.documentElement.classList.remove('night-mode')
    }
  }, [nightMode])

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
    console.log('Wallet button clicked - functionality temporarily disabled')
  }
  
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
          {loading && (
            <div className="typing-mobile">
              <SpinnerLoader size="small" variant="primary" />
            </div>
          )}
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
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -10 }}
                      transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
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
                        {loading ? <SpinnerLoader size="small" variant="white" /> : <Send size={20} active={Boolean(input.trim())} />}
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
                    <SpinnerLoader size="small" variant="white" />
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
            <div className="mobile-nav-buttons">
              {!auth ? (
                <div className="mobile-auth-buttons">
                  {/* Logo beside switch - changes based on night mode */}
                  <img src={nightMode ? logoPng : BrampLogo} alt="Logo" style={{ width: '32px', height: '32px', objectFit: 'contain', marginRight: '8px' }} />
                  {/* SWITCH REMAINS HERE FOR UN-AUTHENTICATED VIEW */}
                  <label className="switch">
                    <input type="checkbox" checked={nightMode} onChange={(e) => setNightMode(e.target.checked)} />
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
                  {/* Logo beside switch - changes based on night mode */}
                  <img src={nightMode ? logoPng : BrampLogo} alt="Logo" style={{ width: '32px', height: '32px', objectFit: 'contain', marginRight: '8px' }} />
                  {/* ADDED SWITCH HERE FOR AUTHENTICATED VIEW */}
                  <label className="switch" style={{ marginRight: '8px' }}>
                    <input type="checkbox" checked={nightMode} onChange={(e) => setNightMode(e.target.checked)} />
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