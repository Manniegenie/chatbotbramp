// src/MobileApp.tsx
import React, { useEffect, useRef, useState } from 'react'
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

// --- Helper Components ---
function MobileNewsSection() {
  const newsCards: NewsCard[] = [
    /* ...your news cards... */
  ];

  const handleCardClick = (card: NewsCard) => {
    if (card.url) window.open(card.url, '_blank', 'noopener,noreferrer');
  };

  const featuredCard = newsCards[0];
  const regularCards = newsCards.slice(1);

  return (
    <section className="mobile-news-section">
      <h2 className="mobile-news-header">Latest News</h2>

      <div className="mobile-news-background card-background">
        {/* Make sure this div is scrollable */}
        <div className="mobile-news-cards-container scrollable">
          {featuredCard && (
            <article
              key={featuredCard.id}
              className="mobile-news-card-featured"
              onClick={() => handleCardClick(featuredCard)}
              role="button"
              tabIndex={0}
            >
              <h3 className="mobile-news-card-title">{featuredCard.title}</h3>
              <p className="mobile-news-card-description">{featuredCard.description}</p>
              <div className="mobile-news-card-meta">
                <span>{featuredCard.date}</span>
                <span>{featuredCard.source}</span>
              </div>
            </article>
          )}

          {regularCards.map((card) => (
            <article
              key={card.id}
              className="mobile-news-card-item"
              onClick={() => handleCardClick(card)}
              role="button"
              tabIndex={0}
            >
              <h3 className="mobile-news-card-title">{card.title}</h3>
              <p className="mobile-news-card-description">{card.description}</p>
              <div className="mobile-news-card-meta">
                <span>{card.date}</span>
                <span>{card.source}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
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
    { component: Bitcoin, name: 'BTC' },
    { component: EthereumCircleFlat, name: 'ETH' },
    { component: Usdc, name: 'USDC' }
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
    if (!auth) {
      setShowSignIn(true)
      return
    }
    setShowLiskWallet(true)
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
          onSuccess={(res) => {
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

                <div style={{ height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                        placeholder="Try: Sell 100 USDT to NGN"
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
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  padding: '8px',
                  minWidth: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <MessageCircleIcon size={24} stroke={showHints ? 'url(#sign-in-gradient)' : 'rgba(255, 255, 255, 0.7)'} />
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
              <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                <input
                  ref={inputRef}
                  className="mobile-input mobile-input-with-send"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={loading ? 'Please wait…' : 'Chat Bramp AI...'}
                  disabled={loading}
                  style={{ paddingRight: '56px' }}
                />
                <button
                  type="submit"
                  className="mobile-send-btn mobile-send-btn-inside"
                  disabled={loading || !input.trim()}
                  aria-label="Send message"
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 10
                  }}
                >
                  {loading ? (
                    <div className="mobile-spinner" />
                  ) : (
                    <Send size={20} active={Boolean(input.trim())} style={{ opacity: loading || !input.trim() ? 0.6 : 1, color: input.trim() ? undefined : 'rgba(255, 255, 255, 0.7)' }} />
                  )}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="mobile-send-btn"
                  onClick={() => setShowVoiceChat(true)}
                  disabled={loading || !auth}
                  aria-label="Voice chat"
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
        <header className="mobile-header">
          <div className="mobile-header-top">
            <div className="mobile-brand">
              <img src={BrampLogo} alt="Bramp" className="mobile-logo" onError={(e) => { e.currentTarget.style.display = 'none' }} />
            </div>

            <div className="mobile-nav-buttons">
              {!auth ? (
                <div className="mobile-auth-buttons">
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
                  <button className="btn mobile-sell-btn mobile-sell-btn-with-icon" onClick={handleSellClick} aria-label="Sell Crypto">
                    <span>Sell</span>
                  </button>
                  <button className="btn mobile-sell-btn mobile-wallet-btn" onClick={handleLiskWalletClick} style={{ marginLeft: '8px' }} aria-label="Connect Wallet">
                    Wallet
                  </button>
                  <button className="mobile-menu-btn" onClick={() => setShowMenu(!showMenu)} aria-label="Menu">
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