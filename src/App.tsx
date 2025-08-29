// App.tsx
import React, { useEffect, useRef, useState } from 'react'
import SignIn, { SignInResult } from './signin'
import { tokenStore } from './lib/secureStore'
import logo from './assets/logo.jpeg'
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

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: crypto.randomUUID(),
    role: 'assistant',
    text: "Hi, I'm Bramp AI. You can say things like 'Sell 200 USDT to NGN' or 'Show my balance'.",
    ts: Date.now()
  }])

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  const [showSell, setShowSell] = useState(false)
  const [openSellAfterAuth, setOpenSellAfterAuth] = useState(false)

  const [auth, setAuth] = useState<SignInResult | null>(() => {
    const { access, refresh } = tokenStore.getTokens()
    const user = tokenStore.getUser()
    return access && refresh && user ? { accessToken: access, refreshToken: refresh, user } : null
  })
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, showSignIn, showSell])

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
        text: `⚠️ Error reaching server: ${err.message}. Check API_BASE and CORS.`,
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
      /\/sell($|\/|\?|#)/,           // /sell at path boundary
      /chatbramp\.com\/sell/,        // specific domain sell page
      /localhost.*\/sell/,           // local dev sell page
      /sell\.html?$/,                // sell.html page
      /\bsell\b/                     // any standalone "sell" word
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
    event?.preventDefault() // Prevent any default link behavior
    
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
          <img src={logo} alt="Bramp AI logo" className="logo" />
        <div>
            <h1>Bramp AI</h1>
            <p className="tag">Secure access to digital assets & payments — via licensed partners.</p>
          </div>
        </div>

        {!auth ? (
          <button className="btn" onClick={() => setShowSignIn(true)}>Sign in</button>
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
      ) : (
        <main className="chat">
          <div className="messages">
            {messages.map(m => (
              <div key={m.id} className={`bubble ${m.role}`}>
                <div className="role">{m.role === 'user' ? 'You' : 'Bramp AI'}</div>
                <div className="text">
                  {m.text}
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
            {loading && <div className="typing">Bramp AI is thinking…</div>}
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
        <a href="/risk" target="_blank">Risk Disclaimer</a>
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
