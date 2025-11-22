// src/MobileApp.tsx
import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { tokenStore } from './lib/secureStore'
import { authFetch, getAuthState, setupAutoLogoutTimer, clearAuth } from './lib/tokenManager'
import { useInactivityTimer } from './lib/useInactivityTimer'
import MobileSignIn, { SignInResult } from './MobileSignIn'
import MobileSignUp, { SignUpResult } from './MobileSignUp'
import MobileSell from './MobileSell'
import MobileGame from './MobileGame';
import MobileVoiceChat from './MobileVoiceChat';
import MobileLiskWallet from './MobileLiskWallet';
import BrampLogo from './assets/logo.jpeg'
import micIcon from './assets/mic.png'
import SendIcon from './assets/send.png'
import { Bitcoin, EthereumCircleFlat, Solana, Bnb, Usdt, Usdc, Exchange02 } from './components/CryptoIcons'
import wallpaper1 from './assets/wallpaper1.jpg'
import Preloader from './Preloader'
import { LogIn } from 'lucide-react'
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

const createSendIconStyle = (active: boolean, disabled: boolean): React.CSSProperties => ({
  width: 28,
  height: 28,
  display: 'inline-block',
  backgroundColor: active ? '#007337' : 'rgba(255, 255, 255, 0.7)',
  maskImage: `url(${SendIcon})`,
  WebkitMaskImage: `url(${SendIcon})`,
  maskRepeat: 'no-repeat',
  WebkitMaskRepeat: 'no-repeat',
  maskPosition: 'center',
  WebkitMaskPosition: 'center',
  maskSize: 'contain',
  WebkitMaskSize: 'contain',
  transition: 'background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  opacity: disabled ? 0.6 : 1,
})

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
): Promise<{ reply: string; cta?: CTA | null; metadata?: any; browsing?: boolean }> {
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

  // If browsing is required, poll for results
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

  // Handle all bold patterns: **bold**, ##bold##, # #bold# #
  text.replace(/(\*\*.*?\*\*|##.*?##|# #.*?# #)/g, (match, offset: number) => {
    if (offset > last) nodes.push(text.slice(last, offset))

    let content = match
    if (match.startsWith('**') && match.endsWith('**')) {
      content = match.slice(2, -2)
    } else if (match.startsWith('##') && match.endsWith('##')) {
      content = match.slice(2, -2)
    } else if (match.startsWith('# #') && match.endsWith('# #')) {
      content = match.slice(3, -3)
    }

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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [showPreloader, setShowPreloader] = useState(true)

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCenteredInput, setShowCenteredInput] = useState(true)
  const [showSignIn, setShowSignIn] = useState(false)
  const [showSignUp, setShowSignUp] = useState(false)
  const [showSell, setShowSell] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [openSellAfterAuth, setOpenSellAfterAuth] = useState(false)
  const [shouldOpenSell, setShouldOpenSell] = useState(false)
  const [showGame, setShowGame] = useState(false)
  const [showVoiceChat, setShowVoiceChat] = useState(false)
  const [showLiskWallet, setShowLiskWallet] = useState(false)

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
    { component: Solana, name: 'SOL' },
    { component: Bitcoin, name: 'BTC' },
    { component: EthereumCircleFlat, name: 'ETH' },
    { component: Bnb, name: 'BNB' },
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

  // Debug ticker
  useEffect(() => {
    console.log('Mobile ticker text:', tickerText)
  }, [tickerText])

  // Cycle through icons
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIconIndex((prev) => (prev + 1) % icons.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [icons.length])

  // Handle automatic sell modal opening
  useEffect(() => {
    if (shouldOpenSell && !showSell) {
      // Use the same logic as manual button click
      handleSellClick()
      setShouldOpenSell(false)
    }
  }, [shouldOpenSell, showSell, auth, setOpenSellAfterAuth, setShowSignIn, setShowCenteredInput, setShowSell, setShowMenu])

  // Parse **text** to <strong>text</strong>
  function parseBoldText(text: string): string {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  }

  // Mobile version of renderMessageText
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

    // Setup automatic logout timer
    const cleanup = setupAutoLogoutTimer((reason) => {
      // Handle auto-logout gracefully
      console.log('Auto-logout triggered:', reason)

      // Clear auth state
      setAuth(null)
      setShowSell(false)
      setShowMenu(false)
      setShowSignIn(false)
      setShowSignUp(false)
      setOpenSellAfterAuth(false)

      // Smooth transition back to centered input view
      setShowCenteredInput(true)
      setMessages([])

      // Prevent iOS from going into protection mode
      if (typeof window !== 'undefined' && window.navigator?.userAgent?.includes('iPhone')) {
        // Force a small DOM update to prevent iOS from thinking the page is inactive
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

  // 45-minute inactivity timer
  useInactivityTimer({
    timeout: 45 * 60 * 1000, // 45 minutes
    onInactive: () => {
      console.log('45 minutes of inactivity detected, returning to centered input')
      setShowCenteredInput(true)
      setMessages([])
    }
  })

  // Auto-scroll to bottom when messages or loading state changes
  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, loading])


  const TICKER_SYMBOLS = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'NGNB']

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
    fetchTickerPrices(ac.signal).catch(() => { })
    return () => ac.abort()
  }, [])


  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || loading) return

    // Switch to bottom input after first message
    if (showCenteredInput) {
      setShowCenteredInput(false)
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

      // Check if this message contains sell intent and should open modal instead
      const hasSellIntent = data.cta?.buttons?.some(btn => isSellCTA(btn))
      if (hasSellIntent) {
        // Don't add the message to chat, just trigger modal opening
        setShouldOpenSell(true)
        setLoading(false)
      } else {
        setMessages((prev) => [...prev, aiMsg])

        // If browsing is required, poll for results
        if (data.browsing) {
          const sessionId = getSessionId()
          const maxAttempts = 60 // Poll for up to 3 minutes (60 * 3 seconds)
          let attempts = 0

          pollInterval = setInterval(async () => {
            attempts++
            try {
              const browsingResult = await pollBrowsingResult(sessionId)

              if (browsingResult.completed) {
                if (pollInterval) clearInterval(pollInterval)
                // Replace the "this might take a while" message with the actual result
                setMessages((prev) => {
                  const updated = [...prev]
                  const browsingMsgIndex = updated.findIndex(m => m.id === aiMsg.id)
                  if (browsingMsgIndex !== -1) {
                    updated[browsingMsgIndex] = {
                      ...updated[browsingMsgIndex],
                      text: browsingResult.reply
                    }
                  }
                  return updated
                })
                setLoading(false)
              } else if (attempts >= maxAttempts) {
                if (pollInterval) clearInterval(pollInterval)
                setMessages((prev) => {
                  const updated = [...prev]
                  const browsingMsgIndex = updated.findIndex(m => m.id === aiMsg.id)
                  if (browsingMsgIndex !== -1) {
                    updated[browsingMsgIndex] = {
                      ...updated[browsingMsgIndex],
                      text: 'Sorry, the request took too long. Please try again.'
                    }
                  }
                  return updated
                })
                setLoading(false)
              }
            } catch (pollError) {
              console.error('Polling browsing result failed:', pollError)
              if (attempts >= maxAttempts) {
                if (pollInterval) clearInterval(pollInterval)
                setLoading(false)
              }
            }
          }, 3000) // Poll every 3 seconds
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
    setShowCenteredInput(false)
    setShowSell(true)
  }

  function handleKycClick(event?: React.MouseEvent) {
    event?.preventDefault()
    setShowMenu(false)
    // KYC functionality disabled for now
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
      // Switch to bottom input when hint is clicked
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

            // Track Facebook pixel CompleteRegistration event
            // Note: This fires on signin, but we'll add a flag to track if it's a new user
            if (typeof window !== 'undefined' && window.fbq) {
              console.log('Firing Facebook pixel CompleteRegistration event (mobile signup)');
              window.fbq('track', 'CompleteRegistration', {
                value: 1,
                currency: 'USD',
              });
            } else {
              console.warn('Facebook pixel not loaded or window.fbq not available (mobile signup)');
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

            // Track Facebook pixel CompleteRegistration event
            if (typeof window !== 'undefined' && window.fbq) {
              console.log('Firing Facebook pixel CompleteRegistration event (mobile signin)');
              window.fbq('track', 'CompleteRegistration', {
                value: 1,
                currency: 'USD',
              });
            } else {
              console.warn('Facebook pixel not loaded or window.fbq not available (mobile signin)');
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
                      {m.cta.buttons.map((btn, index) => {
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

        {showCenteredInput ? (
          <div className="mobile-centered-input">
            <div className="mobile-centered-form">
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
                  <motion.div
                    key={currentIconIndex}
                    className="mobile-app-logo"
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
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {React.createElement(icons[currentIconIndex].component, { size: 62 })}
                  </motion.div>
                </AnimatePresence>
              </div>
              <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center', position: 'relative' }}>
                <input
                  ref={inputRef}
                  className="mobile-input mobile-input-centered"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Try: Sell 100 USDT to NGN"
                  disabled={loading}
                />
                <button
                  type="submit"
                  className="mobile-send-btn mobile-send-inline"
                  disabled={loading || !input.trim()}
                  aria-label="Send message"
                  onClick={sendMessage}
                >
                  {loading ? (
                    <div className="mobile-spinner" />
                  ) : (
                    <span
                      className={`send-icon ${input.trim() ? 'send-icon--active' : ''}`}
                      aria-hidden="true"
                      style={createSendIconStyle(Boolean(input.trim()), loading || !input.trim())}
                    />
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mobile-hints">
              <button
                className="mobile-hint"
                onClick={() => handleHintClick('Sell 100 USDT to NGN')}
              >
                Sell USDT
              </button>
              <button
                className="mobile-hint"
                onClick={() => handleHintClick('Show my portfolio balance')}
              >
                Portfolio
              </button>
              <button
                className="mobile-hint"
                onClick={() => handleHintClick('Current NGN rates')}
              >
                NGN Rates
              </button>
            </div>

            <form className="mobile-composer" onSubmit={sendMessage}>
              <input
                ref={inputRef}
                className="mobile-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={loading ? 'Please wait…' : 'Chat Bramp AI...'}
                disabled={loading}
              />
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="submit"
                  className="mobile-send-btn"
                  disabled={loading || !input.trim()}
                  aria-label="Send message"
                >
                  {loading ? (
                    <div className="mobile-spinner" />
                  ) : (
                    <span
                      className={`send-icon ${input.trim() ? 'send-icon--active' : ''}`}
                      aria-hidden="true"
                      style={createSendIconStyle(Boolean(input.trim()), loading || !input.trim())}
                    />
                  )}
                </button>
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
      <div className={pageClassName} style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
        <MobileGame onClose={() => setShowGame(false)} />
      </div>
    );
  }

  if (showLiskWallet) {
    return (
      <div className={pageClassName} style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
        <MobileLiskWallet onClose={() => setShowLiskWallet(false)} />
      </div>
    );
  }

  if (showVoiceChat) {
    return (
      <div className={pageClassName} style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
        <MobileVoiceChat
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
      </div>
    );
  }

  if (showSell) {
    return (
      <div className={pageClassName} style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
        <MobileSell
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
      <div className={pageClassName} style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
        <MobileSignIn
          onCancel={() => {
            setShowSignIn(false);
            setOpenSellAfterAuth(false);
          }}
          onSuccess={(res) => {
            setAuth(res);
            setShowSignIn(false);
            setShowCenteredInput(false);
            const greeting = getTimeBasedGreeting();
            const name = res.user.username || (res.user as any).firstname || 'there';
            setMessages([
              { id: crypto.randomUUID(), role: 'assistant', text: `${greeting}, ${name}! How can I help you today?`, ts: Date.now() },
            ]);
            if (openSellAfterAuth) {
              setOpenSellAfterAuth(false);
              setShowSell(true);
            }
          }}
        />
      </div>
    );
  }

  if (showSignUp) {
    return (
      <div className={pageClassName} style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
        <MobileSignUp
          onCancel={() => setShowSignUp(false)}
          onSuccess={(_res: SignUpResult) => {
            setShowSignUp(false);
            setShowCenteredInput(false);
            setMessages((prev) => [
              ...prev,
              { id: crypto.randomUUID(), role: 'assistant', text: 'Account created! Please verify your OTP to complete signup.', ts: Date.now() },
            ]);
            setShowSignIn(true);
          }}
        />
      </div>
    );
  }

  // Normal (non-game) mobile app UI
  return (
    <>
      {showPreloader && <Preloader />}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="sign-in-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A80077" />
            <stop offset="100%" stopColor="#66FF00" />
          </linearGradient>
        </defs>
      </svg>
      <div
        className={`${pageClassName} ${messages.length > 0 ? 'mobile-page--chat-active' : ''}`}
        style={{
          ...pageOverlayStyle,
          '--wallpaper-image': `url(${wallpaper1})`
        } as React.CSSProperties}
      >
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
            </div>

            <div className="mobile-nav-buttons">
              {!auth ? (
                <>
                  <div className="mobile-auth-buttons">
                    <button className="mobile-auth-btn mobile-sign-in-btn" onClick={() => setShowSignIn(true)}>
                      <span>Sign In</span>
                      <LogIn className="sign-in-icon" size={16} />
                    </button>
                    <button
                      className="mobile-auth-btn mobile-auth-btn-secondary mobile-create-account-btn"
                      onClick={() => setShowSignUp(true)}
                    >
                      Create Account
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    className="btn mobile-sell-btn mobile-sell-btn-with-icon"
                    onClick={handleSellClick}
                    aria-label="Sell Crypto"
                  >
                    <span>Sell</span>
                    <Exchange02 className="sell-icon" size={16} />
                  </button>
                  <button
                    className="btn mobile-sell-btn mobile-wallet-btn"
                    onClick={handleLiskWalletClick}
                    style={{ marginLeft: '8px' }}
                    aria-label="Connect Wallet"
                  >
                    Wallet
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

        </header>

        {showMenu && auth && (
          <div className="mobile-menu-overlay" onClick={() => setShowMenu(false)}>
            <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
              <button className="mobile-menu-item" onClick={handleKycClick}>
                KYC
              </button>
              <button className="mobile-menu-item primary" onClick={handleSellClick}>
                Sell Crypto
              </button>
              <button className="mobile-menu-item" onClick={handleGameClick}>
                Game
              </button>
              <button className="mobile-menu-item" onClick={handleLiskWalletClick}>
                Connect Lisk Wallet
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
                href="https://drive.google.com/file/d/1brtkc1Tz28Lk3Xb7C0t3--wW7829Txxw/view"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </a>
              <a
                className="mobile-menu-item"
                href="https://www.instagram.com/chatbramp/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram
              </a>
            </div>
          </div>
        )}

        {renderMainContent()}

        <MobileSell
          open={showSell}
          onClose={() => setShowSell(false)}
          onChatEcho={echoFromModalToChat}
          onStartInteraction={() => setShowCenteredInput(false)}
        />

        {!auth && showCenteredInput && (
          <footer className="mobile-footer">
            <div className="mobile-footer-links-bottom">
              <a href="https://drive.google.com/file/d/11qmXGhossotfF4MTfVaUPac-UjJgV42L/view?usp=drive_link" target="_blank" rel="noopener noreferrer">AML/CFT Policy</a>
              <a href="https://drive.google.com/file/d/1brtkc1Tz28Lk3Xb7C0t3--wW7829Txxw/view?usp=drive_link" target="_blank" rel="noopener noreferrer">Privacy</a>
              <a href="https://www.instagram.com/chatbramp/" target="_blank" rel="noopener noreferrer">Instagram</a>
              <a href="https://www.youtube.com/@Chatbramp" target="_blank" rel="noopener noreferrer">YouTube</a>
              <a href="https://x.com/Chatbramp" target="_blank" rel="noopener noreferrer">Twitter</a>
              <a href="https://medium.com/@chatbramp" target="_blank" rel="noopener noreferrer">Medium</a>
            </div>
          </footer>
        )}
      </div>
    </>
  );
}