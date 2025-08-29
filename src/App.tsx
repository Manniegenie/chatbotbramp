// App.tsx
import React, { useEffect, useRef, useState } from 'react'
import SignIn, { SignInResult } from './signin'
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

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: crypto.randomUUID(),
    role: 'assistant',
    text: "bramp-ai ready. try 'sell 200 usdt' or 'balance'",
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
  }, [messages, loading])

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
      const botText = data?.reply ?? 'error: could not process'

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
        text: `error: ${err.message}`,
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

    return sellPatterns.some(pattern => pattern.test(url))
  }

  function handleSellClick(event?: React.MouseEvent) {
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
    <div style={{
      background: '#000',
      color: '#00ff00',
      fontFamily: 'Monaco, "Lucida Console", monospace',
      fontSize: '14px',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Minimal header */}
      <header style={{
        padding: '8px 16px',
        borderBottom: '1px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>bramp-ai terminal</span>
        {!auth ? (
          <button 
            style={{
              background: 'transparent',
              color: '#00ff00',
              border: '1px solid #333',
              padding: '4px 8px',
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
            onClick={() => setShowSignIn(true)}
          >
            login
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: '#666' }}>
              {auth.user?.username || 'user'}@bramp
            </span>
            <button
              style={{
                background: 'transparent',
                color: '#666',
                border: '1px solid #333',
                padding: '4px 8px',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
              onClick={signOut}
            >
              logout
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
              text: `authenticated as ${res.user.username || res.user.firstname || 'user'}`,
              ts: Date.now()
            }])
            if (openSellAfterAuth) {
              setOpenSellAfterAuth(false)
              setShowSell(true)
            }
          }}
        />
      ) : (
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Terminal messages */}
          <div style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            lineHeight: '1.4'
          }}>
            {messages.map(m => (
              <div key={m.id} style={{ marginBottom: '8px' }}>
                <div style={{ color: m.role === 'user' ? '#0099ff' : '#00ff00' }}>
                  {m.role === 'user' ? '>' : '$'} {m.text}
                </div>
                
                {/* CTA buttons as terminal commands */}
                {m.role === 'assistant' && m.cta?.type === 'button' && m.cta.buttons?.length > 0 && (
                  <div style={{ marginTop: '4px', marginLeft: '16px' }}>
                    {m.cta.buttons.map((btn, index) => {
                      const isSell = isSellCTA(btn)
                      
                      if (isSell) {
                        return (
                          <div key={btn.id || index} style={{ marginBottom: '2px' }}>
                            <span
                              style={{
                                color: '#ffff00',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                              }}
                              onClick={handleSellClick}
                            >
                              [{btn.title}]
                            </span>
                          </div>
                        )
                      }
                      
                      return (
                        <div key={btn.id || index} style={{ marginBottom: '2px' }}>
                          <a
                            href={btn.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: '#ffff00',
                              textDecoration: 'underline'
                            }}
                          >
                            [{btn.title}]
                          </a>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
            
            {loading && (
              <div style={{ color: '#666' }}>
                $ processing...
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Terminal input */}
          <form 
            onSubmit={sendMessage}
            style={{
              padding: '16px',
              borderTop: '1px solid #333',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span style={{ color: '#0099ff' }}>{'>'}</span>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="enter command..."
              autoFocus
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#00ff00',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                outline: 'none'
              }}
            />
            <button 
              disabled={loading || !input.trim()}
              style={{
                background: 'transparent',
                color: loading ? '#666' : '#00ff00',
                border: 'none',
                cursor: loading ? 'default' : 'pointer',
                fontFamily: 'inherit',
                padding: '0'
              }}
            >
              {loading ? '...' : '[enter]'}
            </button>
          </form>

          {/* Quick commands */}
          <div style={{
            padding: '0 16px 16px',
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            {['sell 100 usdt', 'balance', 'withdraw 50k'].map(cmd => (
              <span
                key={cmd}
                onClick={() => setInput(cmd)}
                style={{
                  color: '#666',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                {cmd}
              </span>
            ))}
          </div>
        </main>
      )}

      <SellModal
        open={showSell}
        onClose={() => setShowSell(false)}
        onChatEcho={echoFromModalToChat}
      />
    </div>
  )
}