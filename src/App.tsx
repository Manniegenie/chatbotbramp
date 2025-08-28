// App.tsx
import React, { useEffect, useRef, useState } from 'react'
import SignIn, { SignInResult } from './signin'
import { tokenStore } from './lib/secureStore'
import logo from './assets/logo.jpeg'   // 👈 import your logo (png, svg, etc.)

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
  const [auth, setAuth] = useState<SignInResult | null>(() => {
    const { access, refresh } = tokenStore.getTokens()
    const user = tokenStore.getUser()
    return access && refresh && user ? { accessToken: access, refreshToken: refresh, user } : null
  })
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, showSignIn])

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
  }

  return (
    <div className="page">
      <header className="header">
        <div className="brand">
          <img src={logo} alt="Bramp AI logo" className="logo" /> {/* 👈 Logo here */}
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
          onCancel={() => setShowSignIn(false)}
          onSuccess={(res) => {
            setAuth(res)
            setShowSignIn(false)
            setMessages(prev => [...prev, {
              id: crypto.randomUUID(),
              role: 'assistant',
              text: `You're in, ${res.user.username || res.user.firstname || 'there'} ✅`,
              ts: Date.now()
            }])
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
                      {m.cta.buttons.map((b) => (
                        <a
                          key={b.id}
                          className="btn"
                          href={b.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={b.style === 'primary'
                            ? undefined
                            : { background: 'transparent', border: '1px solid var(--border)', color: 'var(--txt)' }}
                        >
                          {b.title}
                        </a>
                      ))}
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

      <footer className="footer">
        <a href="/aml" target="_blank">AML/CFT Policy</a>
        <a href="/risk" target="_blank">Risk Disclaimer</a>
        <a href="/privacy" target="_blank">Privacy</a>
        <a href="/terms" target="_blank">Terms</a>
      </footer>
    </div>
  )
}
