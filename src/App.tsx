import React, { useEffect, useRef, useState } from 'react'
import SignIn, { SignInResult } from './signin'
import SignUp, { SignUpResult } from './signup'
import { tokenStore } from './lib/secureStore'
import SellModal from './sell'

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

// Always read the freshest token from secure storage
async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { access } = tokenStore.getTokens()
  const headers = new Headers(init.headers || {})
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (access) headers.set('Authorization', `Bearer ${access}`)
  return fetch(input, { ...init, headers })
}

/** ---------- Linkify helpers (shorten + hyperlink like AI terminals) ---------- */

const URL_REGEX = /https?:\/\/[^\s<>"')]+/gi

function shortenUrlForDisplay(raw: string) {
  try {
    const u = new URL(raw)
    // Build a compact label: domain + condensed path
    const host = u.host.replace(/^www\./, '')
    let path = u.pathname || ''
    // Collapse long paths => /a/.../last
    if (path.length > 20) {
      const segs = path.split('/').filter(Boolean)
      if (segs.length > 2) path = `/${segs[0]}/…/${segs[segs.length - 1]}`
    }
    let label = host + (path === '/' ? '' : path)
    // Indicate query/fragment existence without noise
    if (u.search) label += '…'
    if (u.hash && !u.search) label += '…'
    // Hard cap
    return label.length > 48 ? label.slice(0, 45) + '…' : label
  } catch {
    return raw.length > 48 ? raw.slice(0, 45) + '…' : raw
  }
}

function linkifyText(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // Preserve newlines
  const lines = text.split(/\r?\n/)
  lines.forEach((line, li) => {
    let lastIdx = 0
    line.replace(URL_REGEX, (match, offset: number) => {
      // Exclude trailing punctuation from the link
      const trimmed = match.replace(/[),.;!?]+$/g, '')
      const trailing = match.slice(trimmed.length)

      if (offset > lastIdx) nodes.push(line.slice(lastIdx, offset))

      nodes.push(
        <a
          key={`${match}-${offset}-${li}`}
          href={trimmed}
          target="_blank"
          rel="noopener noreferrer"
        >
          {shortenUrlForDisplay(trimmed)}
        </a>
      )

      if (trailing) nodes.push(trailing)
      lastIdx = offset + match.length
      return match
    })
    if (lastIdx < line.length) nodes.push(line.slice(lastIdx))
    if (li < lines.length - 1) nodes.push(<br key={`br-${li}`} />)
  })
  return nodes
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: crypto.randomUUID(),
    role: 'assistant',
    text: "Hey! I’m Bramp AI 🤖🇳🇬 Buy/sell crypto, see rates, and cash out to NGN—right here in chat. Try: ‘Sell 100 USDT to NGN’ 💸",
    ts: Date.now()
  }])

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [thinkingPhase, setThinkingPhase] = useState<'thinking' | 'browsing'>('thinking') // 👈 phase switch
  const [showSignIn, setShowSignIn] = useState(false)
  const [showSignUp, setShowSignUp] = useState(false)
  const [showSell, setShowSell] = useState(false)
  const [openSellAfterAuth, setOpenSellAfterAuth] = useState(false)

  const [auth, setAuth] = useState<SignInResult | null>(() => {
    const { access, refresh } = tokenStore.getTokens()
    const user = tokenStore.getUser()
    return access && refresh && user ? { accessToken: access, refreshToken: refresh, user } : null
  })
  const endRef = useRef<HTMLDivElement>(null)

  // 🔒 Scrub sensitive URL params on load (no user_id in URL)
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.has('user_id')) {
        url.searchParams.delete('user_id')
        const clean = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') + url.hash
        window.history.replaceState({}, '', clean)
      }
    } catch {
      // ignore if URL parsing fails
    }
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, showSignIn, showSignUp, showSell])

  // ⏲️ Switch "thinking" → "browsing" after ~2.5s if still loading
  useEffect(() => {
    let timer: number | undefined
    if (loading) {
      setThinkingPhase('thinking')
      timer = window.setTimeout(() => setThinkingPhase('browsing'), 2500)
    }
    return () => {
      if (timer) window.clearTimeout(timer)
    }
  }, [loading])

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || loading) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: trimmed,
      ts: Date.now()
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await authFetch(`${API_BASE}/chatbot/chat`, {
        method: 'POST',
        body: JSON.stringify({ message: trimmed, history: messages.slice(-10) })
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const botText = data?.reply ?? 'Sorry, I could not process that.'

      const botMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: botText,
        ts: Date.now(),
        cta: data?.cta || null,
      }
      setMessages(prev => [...prev, botMsg])
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: `⚠️ Error reaching server: ${err.message}. Network Error.`,
        ts: Date.now()
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setLoading(false)
    }
  }

  function signOut() {
    tokenStore.clear()
    setAuth(null)
    setShowSell(false)
  }

  // Enhanced Sell CTA detector with better debugging
  function isSellCTA(btn: CTAButton): boolean {
    if (!btn) {
      console.log('❌ No button provided to isSellCTA')
      return false
    }

    console.log('🔍 Checking button:', { id: btn.id, title: btn.title, url: btn.url })

    // Primary check: button ID is "start_sell"
    if (btn.id === 'start_sell') {
      console.log('✅ Matched by ID: start_sell')
      return true
    }

    // Secondary check: URL contains sell-related patterns
    const url = String(btn.url || '').toLowerCase()
    console.log('🔍 Checking URL patterns for:', url)

    const sellPatterns = [
      /\/sell($|\/|\?|#)/,
      /chatbramp\.com\/sell/,
      /localhost.*\/sell/,
      /sell\.html?$/,
      /\bsell\b/
    ]

    for (const pattern of sellPatterns) {
      if (pattern.test(url)) {
        console.log('✅ Matched URL pattern:', pattern.source)
        return true
      }
    }

    console.log('❌ No sell patterns matched for button')
    return false
  }

  function handleSellClick(event?: React.MouseEvent) {
    console.log('🔥 Sell button clicked!')
    event?.preventDefault()
    if (!auth) {
      console.log('📝 User not authenticated, showing sign-in')
      setOpenSellAfterAuth(true)
      setShowSignIn(true)
      return
    }
    console.log('🎯 Opening sell modal')
    setShowSell(true)
  }

  // Allow the Sell modal to push friendly recap messages into chat
  function echoFromModalToChat(text: string) {
    if (!text) return
    setMessages(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        text,
        ts: Date.now(),
      },
    ])
  }

  return (
    <div className="page">
      <header className="header">
        <div className="brand">
          {/* Strapline only — removed logo and title */}
          <p className="tag">Secure access to digital assets & payments — via licensed partners.</p>
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
            <span className="tag">Signed in{auth.user?.username ? ` as ${auth.user.username}` : ''}</span>
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
          onCancel={() => {
            setShowSignIn(false)
            setOpenSellAfterAuth(false)
          }}
          onSuccess={(res) => {
            setAuth(res)
            setShowSignIn(false)
            setMessages(prev => [...prev, {
              id: crypto.randomUUID(),
              role: 'assistant',
              text: `You're in, ${res.user.username || res.user.firstname || 'there'} ✅`,
              ts: Date.now()
            }])
            if (openSellAfterAuth) {
              setOpenSellAfterAuth(false)
              setShowSell(true)
            }
          }}
        />
      ) : showSignUp ? (
        <SignUp
          onCancel={() => setShowSignUp(false)}
          onSuccess={(res: SignUpResult) => {
            setShowSignUp(false)
            setMessages(prev => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: 'assistant',
                text:
                  res.message ||
                  'Account created. Please verify OTP to complete your signup.',
                ts: Date.now(),
              },
            ])
            // After signup, guide them to sign in to continue.
            setShowSignIn(true)
          }}
        />
      ) : (
        <main className="chat">
          <div className="messages">
            {messages.map(m => (
              <div key={m.id} className={`bubble ${m.role}`}>
                <div className="role">{m.role === 'user' ? 'You' : 'Bramp AI'}</div>
                <div className="text">
                  {/* 🔗 Linkify + shorten URLs in message text */}
                  {linkifyText(m.text)}

                  {m.role === 'assistant' && m.cta?.type === 'button' && m.cta.buttons?.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {m.cta.buttons.map((btn, index) => {
                        const isSell = isSellCTA(btn)
                        console.log('🎨 Rendering button:', {
                          index,
                          id: btn.id,
                          title: btn.title,
                          isSell,
                          url: btn.url
                        })

                        if (isSell) {
                          return (
                            <button
                              key={btn.id || btn.title || index}
                              className="btn"
                              onClick={handleSellClick}
                              style={btn.style === 'primary'
                                ? undefined
                                : { background: 'transparent', border: '1px solid var(--border)', color: 'var(--txt)' }}
                            >
                              {btn.title}
                            </button>
                          )
                        }

                        // Non-sell buttons remain as links
                        return (
                          <a
                            key={btn.id || btn.title || index}
                            className="btn"
                            href={btn.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={btn.style === 'primary'
                              ? undefined
                              : { background: 'transparent', border: '1px solid var(--border)', color: 'var(--txt)' }}
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
            {loading && (
              <div className="typing">
                {thinkingPhase === 'thinking' ? 'Bramp AI is thinking…' : 'Bramp AI is browsing…'}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form className="composer" onSubmit={sendMessage}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Try: Sell 100 USDT to NGN"
              autoFocus
            />
            <button className="btn" disabled={loading || !input.trim()}>
              {loading ? 'Sending…' : 'Send'}
            </button>
          </form>

          <div className="hints">
            <span className="hint" onClick={() => setInput('Sell 100 USDT to NGN')}>Sell 100 USDT to NGN</span>
            <span className="hint" onClick={() => setInput('Show my portfolio balance')}>Show my portfolio balance</span>
            <span className="hint" onClick={() => setInput('Withdraw ₦50,000 to GTBank')}>Withdraw ₦50,000 to GTBank</span>
          </div>
        </main>
      )}

      {/* Sell modal */}
      <SellModal
        open={showSell}
        onClose={() => setShowSell(false)}
        onChatEcho={echoFromModalToChat}
      />

      <footer className="footer">
        <a
          href="https://drive.google.com/file/d/11qmXGhossotfF4MTfVaUPac-UjJgV42L/view?usp=drive_link"
          target="_blank"
          rel="noopener noreferrer"
        >
          AML/CFT Policy
        </a>
        <a href="https://drive.google.com/file/d/1FjCZHHg0KoOq-6Sxx_gxGCDhLRUrFtw4/view?usp=sharing" target="_blank">Risk Disclaimer</a>
        <a
          href="https://drive.google.com/file/d/1brtkc1Tz28Lk3Xb7C0t3--wW7829Txxw/view?usp=drive_link"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy
        </a>
        <a href="/terms" target="_blank">Terms</a>
      </footer>
    </div>
  )
}
