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

/* ----------------------- Linkify + Markdown-lite helpers ----------------------- */

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
    return label.length > 48 ? label.slice(0, 45) + '…' : label
  } catch {
    return raw.length > 48 ? raw.slice(0, 45) + '…' : raw
  }
}

function inlineRender(text: string, keyPrefix: string): React.ReactNode[] {
  // First, render markdown links [label](url)
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

  // Then, linkify any remaining bare URLs inside existing nodes
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
        <a key={`${keyPrefix}-url-${i}-${offset}`} href={trimmed} target="_blank" rel="noopener noreferrer">
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
  // Split into paragraphs by blank line
  const paragraphs = text.split(/\r?\n\s*\r?\n/)
  const rendered: React.ReactNode[] = []

  paragraphs.forEach((para, pi) => {
    // Is this a bullet list block?
    const lines = para.split(/\r?\n/)
    const isListBlock = lines.every(l => l.trim().startsWith('- '))
    if (isListBlock) {
      rendered.push(
        <ul key={`ul-${pi}`} style={{ margin: '8px 0', paddingLeft: 18 }}>
          {lines.map((l, li) => {
            const item = l.replace(/^\s*-\s*/, '')
            return <li key={`li-${pi}-${li}`} style={{ margin: '4px 0' }}>{inlineRender(item, `li-${pi}-${li}`)}</li>
          })}
        </ul>
      )
    } else {
      // Normal paragraph; preserve single newlines
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

/* ----------------------------------- App ----------------------------------- */

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: crypto.randomUUID(),
    role: 'assistant',
    text: "Hey! I’m Bramp AI 🤖🇳🇬 Buy/sell crypto, see rates, and cash out to NGN—right here in chat. Try: ‘Sell 100 USDT to NGN’ 💸",
    ts: Date.now()
  }])

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  // typing indicator phases + emoji ticker
  const [thinkingPhase, setThinkingPhase] = useState<'thinking' | 'browsing'>('thinking')
  const [emojiTick, setEmojiTick] = useState(0)

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

  // Scrub sensitive URL params on load
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.has('user_id')) {
        url.searchParams.delete('user_id')
        const clean = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') + url.hash
        window.history.replaceState({}, '', clean)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, showSignIn, showSignUp, showSell])

  // Flip thinking → browsing after ~2.5s if still loading
  useEffect(() => {
    let phaseTimer: number | undefined
    let emojiTimer: number | undefined

    if (loading) {
      setThinkingPhase('thinking')
      setEmojiTick(0)
      phaseTimer = window.setTimeout(() => setThinkingPhase('browsing'), 2500)

      // While browsing, alternate 🌍 / 🪙 every ~600ms to show activity
      emojiTimer = window.setInterval(() => {
        setEmojiTick(t => (t + 1) % 2)
      }, 600)
    }

    return () => {
      if (phaseTimer) window.clearTimeout(phaseTimer)
      if (emojiTimer) window.clearInterval(emojiTimer)
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

  // Enhanced Sell CTA detector
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
    return sellPatterns.some(rx => rx.test(url))
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

  // Emoji to show while "browsing"
  const browsingEmoji = emojiTick % 2 === 0 ? '🌍' : '🪙'

  return (
    <div className="page">
      <header className="header">
        <div className="brand">
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
                  {renderMessageText(m.text)}

                  {m.role === 'assistant' && m.cta?.type === 'button' && m.cta.buttons?.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {m.cta.buttons.map((btn, index) => {
                        const isSell = isSellCTA(btn)
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
                {thinkingPhase === 'thinking'
                  ? 'Bramp AI is thinking…'
                  : `Bramp AI is browsing… ${browsingEmoji}`}
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
