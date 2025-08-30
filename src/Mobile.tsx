// src/mobile.tsx
import React, { useEffect, useRef, useState } from 'react'
import SignIn, { SignInResult } from './signin'
import { tokenStore } from './lib/secureStore'
import logo from './assets/logo.jpeg'
import SellModal from './sell'
import './mobile.css' // mobile-first styles only

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

// ensure 100vh works nicely on mobile browsers (esp. iOS)
function useViewportHeightVar() {
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01
      document.documentElement.style.setProperty('--vh', `${vh}px`)
    }
    setVH()
    window.addEventListener('resize', setVH)
    window.addEventListener('orientationchange', setVH)
    return () => {
      window.removeEventListener('resize', setVH)
      window.removeEventListener('orientationchange', setVH)
    }
  }, [])
}

export default function MobileApp() {
  useViewportHeightVar()

  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: crypto.randomUUID(),
    role: 'assistant',
    text: "Hi, I'm Bramp AI. You can say things like “Sell 200 USDT to NGN” or “Show my balance.”",
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
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
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
    setMessages((prev: ChatMessage[]) => [...prev, userMsg])
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
      setMessages((prev: ChatMessage[]) => [...prev, botMsg])
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: `⚠️ Error reaching server: ${err.message}. Check API_BASE and CORS.`,
        ts: Date.now()
      }
      setMessages((prev: ChatMessage[]) => [...prev, errMsg])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function signOut() {
    tokenStore.clear()
    setAuth(null)
    setShowSell(false)
    setMessages((prev: ChatMessage[]) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'assistant', text: 'You’ve been signed out.', ts: Date.now() }
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
      /\bsell\b/
    ]
    return sellPatterns.some((p) => p.test(url))
  }

  function handleSellClick(event?: React.MouseEvent<HTMLElement>) {
    event?.preventDefault()
    if (!auth) {
      setOpenSellAfterAuth(true)
      setShowSignIn(true)
      return
    }
    setShowSell(true)
  }

  function echoFromModalToChat(text: string) {
    if (!text) return
    setMessages((prev: ChatMessage[]) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'assistant', text, ts: Date.now() }
    ])
  }

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!loading && input.trim()) sendMessage()
    }
  }

  const quickHints = [
    'Sell 100 USDT to NGN',
    'Show my portfolio balance',
    'Withdraw ₦50,000 to GTBank'
  ]

  return (
    <div className="page">
      <header className="appbar" role="banner">
        <div className="brand">
          <img src={logo} alt="Bramp AI" className="logo" />
          <div className="brand-meta">
            <h1 className="title">Bramp AI</h1>
            <p className="tag">Secure access to digital assets & payments — via licensed partners.</p>
          </div>
        </div>

        {!auth ? (
          <button className="btn btn-ghost" onClick={() => setShowSignIn(true)} aria-label="Sign in">
            Sign in
          </button>
        ) : (
          <div className="signed-in">
            <span className="signed-as">Signed in{auth.user?.username ? ` as ${auth.user.username}` : ''}</span>
            <button className="btn btn-ghost" onClick={signOut} aria-label="Sign out">Sign out</button>
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
            setMessages((prev: ChatMessage[]) => [...prev, {
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
        <>
          <main className="chat" role="log" aria-live="polite" aria-relevant="additions text">
            <ul className="thread">
              {messages.map((m: ChatMessage) => (
                <li key={m.id} className={`bubble ${m.role === 'user' ? 'from-user' : 'from-assistant'}`}>
                  <div className="bubble-meta">
                    <span className="role">{m.role === 'user' ? 'You' : 'Bramp AI'}</span>
                  </div>
                  <div className="bubble-text">
                    {m.text}
                    {m.role === 'assistant' && m.cta?.type === 'button' && m.cta.buttons?.length > 0 && (
                      <div className="cta-buttons" role="group" aria-label="Actions">
                        {m.cta.buttons.map((btn: CTAButton, index: number) => {
                          const isSell = isSellCTA(btn)
                          if (isSell) {
                            return (
                              <button
                                key={btn.id || btn.title || index}
                                className={`btn ${btn.style === 'primary' ? '' : 'btn-outline'} btn-block`}
                                onClick={handleSellClick}
                              >
                                {btn.title}
                              </button>
                            )
                          }
                          return (
                            <a
                              key={btn.id || btn.title || index}
                              className={`btn ${btn.style === 'primary' ? '' : 'btn-outline'} btn-block`}
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
                </li>
              ))}
              {loading && (
                <li className="typing">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                  <span className="sr-only">Bramp AI is typing…</span>
                </li>
              )}
              <div ref={endRef} />
            </ul>
          </main>

          <div className="quick-hints" role="tablist" aria-label="Quick suggestions">
            <div className="chips">
              {quickHints.map((hint) => (
                <button
                  key={hint}
                  className="chip"
                  onClick={() => {
                    setInput(hint)
                    inputRef.current?.focus()
                  }}
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>

          <form className="composer" onSubmit={sendMessage}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Try: Sell 100 USDT to NGN"
              autoFocus
              aria-label="Message Bramp AI"
              inputMode="text"
              autoCapitalize="sentences"
              autoComplete="off"
              autoCorrect="on"
            />
            <button className="btn btn-send" disabled={loading || !input.trim()} aria-label="Send message">
              {loading ? 'Sending…' : 'Send'}
            </button>
          </form>
        </>
      )}

      {!showSignIn && (
        <button
          className="fab"
          onClick={handleSellClick}
          aria-label="Start a sell"
          title="Start a sell"
        >
          Sell
        </button>
      )}

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
        <a
          href="https://drive.google.com/file/d/1FjCZHHg0KoOq-6Sxx_gxGCDhLRUrFtw4/view?usp=sharing"
          target="_blank"
          rel="noopener noreferrer"
        >
          Risk Disclaimer
        </a>
        <a
          href="https://drive.google.com/file/d/1brtkc1Tz28Lk3Xb7C0t3--wW7829Txxw/view?usp=drive_link"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy
        </a>
        <a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a>
      </footer>
    </div>
  )
}
