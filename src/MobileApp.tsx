// src/MobileApp.tsx
import React, { useEffect, useRef, useState } from 'react'
import { tokenStore } from './lib/secureStore'
import { authFetch, getAuthState, setupAutoLogoutTimer, clearAuth } from './lib/tokenManager'
import MobileSignIn, { SignInResult } from './MobileSignIn'
import MobileSignUp, { SignUpResult } from './MobileSignUp'
import MobileSell from './MobileSell'
import WallpaperSlideshow from './WallpaperSlideshow'
import BrampLogo from './assets/logo.jpeg'
import './MobileApp.css'

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

// Token management functions are now imported from tokenManager.ts

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}

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
    metadata: data.metadata,
  }
}

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
    return label.length > 40 ? label.slice(0, 37) + '…' : label
  } catch {
    return raw.length > 40 ? raw.slice(0, 37) + '…' : raw
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
    if (typeof node !== 'string') {
      finalNodes.push(node)
      return
    }

    let idx = 0
    node.replace(URL_REGEX, (url: string, offset: number) => {
      const trimmed = url.replace(/[),.;!?]+$/g, '')
      const trailing = url.slice(trimmed.length)
      if (offset > idx) finalNodes.push(node.slice(idx, offset))
      finalNodes.push(
        <a
          key={`${keyPrefix}-url-${i}-${offset}`}
          href={trimmed}
          target="_blank"
          rel="noopener noreferrer"
        >
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

export default function MobileApp() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: "👋 Hey! I'm Bramp AI — your crypto assistant. Sign in to get started!",
      ts: Date.now(),
    },
  ])

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  const [showSignUp, setShowSignUp] = useState(false)
  const [showSell, setShowSell] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
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
  const [tickerText, setTickerText] = useState<string>('Loading prices...')

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
    } catch {}

    // Setup automatic logout timer
    const cleanup = setupAutoLogoutTimer((reason) => {
      // Handle auto-logout
      console.log('Auto-logout triggered:', reason)
      setAuth(null)
      setShowSell(false)
      setShowMenu(false)
      
      // Show appropriate message based on reason
      const message = reason === 'token_expired' 
        ? 'Your session has expired. Please sign in again.'
        : 'Session timeout reached. Please sign in again.'
      
      setMessages([
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: message,
          ts: Date.now(),
        }
      ])
    })

    return cleanup
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const TICKER_SYMBOLS = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'MATIC', 'AVAX', 'SOL', 'NGNB']

  async function fetchTickerPrices(signal?: AbortSignal) {
    try {
      const symbolParam = TICKER_SYMBOLS.join(',')
      const url = `${API_BASE}/prices/prices?symbols=${encodeURIComponent(
        symbolParam
      )}&changes=true&limit=9`
      const resp = await authFetch(url, { method: 'GET', signal })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)

      const payload = await resp.json()
      if (!payload?.success || !payload?.data) {
        throw new Error('Invalid prices response')
      }

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
      if (text) {
        setTickerText(text)
      } else {
        setTickerText('BTC • ETH • USDT • Live crypto prices loading...')
      }
    } catch (err) {
      console.warn('Ticker fetch failed', err)
      setTickerText('BTC • ETH • USDT • Live crypto prices')
    }
  }

  useEffect(() => {
    const ac = new AbortController()
    fetchTickerPrices(ac.signal).catch(() => {})
    return () => ac.abort()
  }, [])

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || loading) return

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

    try {
      const data = await sendChatMessage(trimmed, [...messages, userMsg])
      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: data.reply,
        ts: Date.now(),
        cta: data.cta || null,
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch (error) {
      console.error('Chat message failed:', error)
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: `Error: ${getErrorMessage(error)}`,
        ts: Date.now(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  function signOut() {
    clearAuth()
    setAuth(null)
    setShowSell(false)
    setShowMenu(false)
    setMessages([
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: "👋 You've been signed out. Sign in again to continue!",
        ts: Date.now(),
      },
    ])
  }

  function isSellCTA(btn: CTAButton): boolean {
    if (!btn) return false
    if (btn.id === 'start_sell') return true
    const url = String(btn.url || '').toLowerCase()
    const sellPatterns = [
      /\/sell($|\/|\?|#)/,
      /chatbramp\.com\/sell/,
      /localhost.*\/sell/,
      /sell\.html?$/,
      /\bsell\b/,
    ]
    return sellPatterns.some((rx) => rx.test(url))
  }

  function handleSellClick(event?: React.MouseEvent) {
    event?.preventDefault()
    setShowMenu(false)
    if (!auth) {
      setOpenSellAfterAuth(true)
      setShowSignIn(true)
      return
    }
    setShowSell(true)
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
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: 'assistant',
                text: 'Account created! Please verify your OTP to complete signup.',
                ts: Date.now(),
              },
            ])
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
                      {m.cta.buttons.map((btn, index) => {
                        const isSell = isSellCTA(btn)
                        if (isSell) {
                          return (
                            <button
                              key={btn.id || btn.title || index}
                              className="mobile-cta-btn"
                              onClick={handleSellClick}
                            >
                              {btn.title}
                            </button>
                          )
                        }
                        return (
                          <a
                            key={btn.id || btn.title || index}
                            className="mobile-cta-btn"
                            href={btn.url}
                            target="_blank"
                            rel="noopener noreferrer"
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

        <div className="mobile-hints">
          <button
            className="mobile-hint"
            onClick={() => handleHintClick('Sell 100 USDT to NGN')}
          >
            💰 Sell USDT
          </button>
          <button
            className="mobile-hint"
            onClick={() => handleHintClick('Show my portfolio balance')}
          >
            📊 Portfolio
          </button>
          <button
            className="mobile-hint"
            onClick={() => handleHintClick('Current NGN rates')}
          >
            💱 NGN Rates
          </button>
        </div>

        <form className="mobile-composer" onSubmit={sendMessage}>
          <input
            ref={inputRef}
            className="mobile-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={loading ? 'Please wait…' : 'Message Bramp AI...'}
            disabled={loading}
          />
          <button
            type="submit"
            className="mobile-send-btn"
            disabled={loading || !input.trim()}
            aria-label="Send message"
          >
            {loading ? (
              <div className="mobile-spinner" />
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
        </form>
      </main>
    )
  }

  return (
    <div className="mobile-page">
      <WallpaperSlideshow />
      <header className="mobile-header">
        <div className="mobile-header-top">
          <div className="mobile-brand">
            <img
              src={BrampLogo}
              alt="Bramp"
              className="mobile-logo"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
            <span className="mobile-brand-text">Bramp AI</span>
          </div>

          <div className="mobile-nav-buttons">
            {!auth ? (
              <>
                <div className="mobile-auth-buttons">
                  <button className="mobile-auth-btn" onClick={() => setShowSignIn(true)}>
                    Sign in
                  </button>
                  <button
                    className="mobile-auth-btn mobile-auth-btn-secondary"
                    onClick={() => setShowSignUp(true)}
                  >
                    Sign up
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  className="mobile-sell-btn"
                  onClick={handleSellClick}
                  aria-label="Sell Crypto"
                >
                  Sell
                </button>
                <button
                  className="mobile-menu-btn"
                  onClick={() => setShowMenu(!showMenu)}
                  aria-label="Menu"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {tickerText && (
          <div className="mobile-ticker-wrap">
            <div className="mobile-ticker">
              {tickerText}  •  {tickerText}
            </div>
          </div>
        )}
      </header>

      {showMenu && auth && (
        <div className="mobile-menu-overlay" onClick={() => setShowMenu(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-user">{auth.user?.username || 'User'}</div>
            <button className="mobile-menu-item primary" onClick={handleSellClick}>
              Sell Crypto
            </button>
            <button className="mobile-menu-item" onClick={signOut}>
              Sign Out
            </button>
            <div className="mobile-menu-divider"></div>
            <a
              className="mobile-menu-item"
              href="https://drive.google.com/file/d/11qmXGhossotfF4MTfVaUPac-UjJgV42L/view"
              target="_blank"
              rel="noopener noreferrer"
            >
              AML/CFT Policy
            </a>
            <a
              className="mobile-menu-item"
              href="https://drive.google.com/file/d/1FjCZHHg0KoOq-6Sxx_gxGCDhLRUrFtw4/view"
              target="_blank"
              rel="noopener noreferrer"
            >
              Risk Disclaimer
            </a>
            <a
              className="mobile-menu-item"
              href="https://drive.google.com/file/d/1brtkc1Tz28Lk3Xb7C0t3--wW7829Txxw/view"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
            <a
              className="mobile-menu-item"
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
            >
              Terms of Service
            </a>
          </div>
        </div>
      )}

      {renderMainContent()}

      <MobileSell
        open={showSell}
        onClose={() => setShowSell(false)}
        onChatEcho={echoFromModalToChat}
      />

      <footer className="mobile-footer">
        <div className="mobile-footer-text">© 2025 Bramp Africa Limited</div>
      </footer>
    </div>
  )
}