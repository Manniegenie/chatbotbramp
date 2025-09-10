// src/App.tsx
import React, { useEffect, useRef, useState } from 'react'
import SignIn, { SignInResult } from './signin'
import SignUp, { SignUpResult } from './signup'
import { tokenStore } from './lib/secureStore'
import SellModal from './sell'
import BuyModal from './buy'

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
  isStreaming?: boolean
}

// --- session id (stable across page loads) ---
function getSessionId(): string {
  const key = 'bramp__session_id'
  let sid = localStorage.getItem(key)
  if (!sid) {
    sid = crypto.randomUUID()
    localStorage.setItem(key, sid)
  }
  return sid
}

// Always read the freshest token from secure storage
function isExpiredJwt(token: string): boolean {
  try {
    const [, payloadB64] = token.split('.')
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    const { exp } = JSON.parse(json)
    return !exp || Date.now() >= exp * 1000
  } catch { return true }
}

async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { access } = tokenStore.getTokens()
  const headers = new Headers(init.headers || {})
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (access && !isExpiredJwt(access)) headers.set('Authorization', `Bearer ${access}`)
  return fetch(input, { ...init, headers })
}

/* ----------------------- Error helper (fixes TS2339) ----------------------- */
function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try { return JSON.stringify(e) } catch { return String(e) }
}

// ===== Simulated Streaming Implementation =====

// Helper function to simulate typing effect
async function simulateTypingEffect(
  fullText: string, 
  onChunk: (text: string) => void,
  options: {
    wordsPerChunk?: number
    delayBetweenChunks?: number
    minDelay?: number
    maxDelay?: number
  } = {}
): Promise<void> {
  const {
    wordsPerChunk = 2,
    delayBetweenChunks = 120,
    minDelay = 80,
    maxDelay = 200
  } = options

  const words = fullText.split(' ')
  let currentText = ''

  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const chunk = words.slice(i, i + wordsPerChunk)
    currentText += (currentText ? ' ' : '') + chunk.join(' ')
    
    // Update the display
    onChunk(currentText)
    
    // Don't delay after the last chunk
    if (i + wordsPerChunk < words.length) {
      // Variable delay to make it feel more natural
      const randomDelay = Math.random() * (maxDelay - minDelay) + minDelay
      const delay = Math.min(delayBetweenChunks + randomDelay, maxDelay)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

// Simulated streaming message function
async function sendSimulatedStreamingMessage(
  message: string,
  history: ChatMessage[],
  onChunk: (text: string) => void,
  onTyping?: (isTyping: boolean) => void
): Promise<{ reply: string; cta?: CTA | null; metadata?: any }> {
  const { access } = tokenStore.getTokens()

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (access && !isExpiredJwt(access)) headers['Authorization'] = `Bearer ${access}`

  // Show typing indicator
  onTyping?.(true)

  try {
    // Make regular HTTP request to /chat endpoint
    const response = await fetch(`${API_BASE}/chatbot/chat`, {
      method: 'POST',
      headers,
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
    const fullText = data?.reply ?? 'Sorry, I could not process that.'
    
    // Stop typing indicator
    onTyping?.(false)

    // Simulate streaming by gradually revealing text
    await simulateTypingEffect(fullText, onChunk, {
      wordsPerChunk: 2,
      delayBetweenChunks: 120,
      minDelay: 80,
      maxDelay: 200
    })

    return {
      reply: fullText,
      cta: data.cta || null,
      metadata: data.metadata
    }

  } catch (error) {
    onTyping?.(false)
    throw error
  }
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
    if (typeof node !== 'string') { finalNodes.push(node); return }
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

/* ----------------------------------- App ----------------------------------- */

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      text:
        "Hey! I'm Bramp AI—your fast lane from crypto to NGN. " +
        "Sign in to unlock live rates, instant quotes, and one-tap cashouts. " +
        "Try: 'Sell 100 USDT to NGN'",
      ts: Date.now(),
    },
  ])

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isTyping, setIsTyping] = useState(false)

  const [thinkingPhase, setThinkingPhase] = useState<'thinking' | 'browsing' | 'streaming'>('thinking')
  const [emojiTick, setEmojiTick] = useState(0)

  const [showSignIn, setShowSignIn] = useState(false)
  const [showSignUp, setShowSignUp] = useState(false)
  const [showSell, setShowSell] = useState(false)
  const [showBuy, setShowBuy] = useState(false)

  const [openSellAfterAuth, setOpenSellAfterAuth] = useState(false)
  const [openBuyAfterAuth, setOpenBuyAfterAuth] = useState(false)

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
      let changed = false
      for (const p of ['user_id', 'token', 'code']) {
        if (url.searchParams.has(p)) { url.searchParams.delete(p); changed = true }
      }
      if (changed) {
        const clean = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') + url.hash
        window.history.replaceState({}, '', clean)
      }
    } catch { /* noop */ }
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, showSignIn, showSignUp, showSell, showBuy])

  useEffect(() => {
    let phaseTimer: number | undefined
    let emojiTimer: number | undefined
    if (loading && !isStreaming && !isTyping) {
      setThinkingPhase('thinking')
      setEmojiTick(0)
      phaseTimer = window.setTimeout(() => setThinkingPhase('browsing'), 2500)
      emojiTimer = window.setInterval(() => setEmojiTick((t) => (t + 1) % 2), 600)
    } else if (isTyping || isStreaming) {
      setThinkingPhase('streaming')
    }
    return () => {
      if (phaseTimer) window.clearTimeout(phaseTimer)
      if (emojiTimer) window.clearInterval(emojiTimer)
    }
  }, [loading, isStreaming, isTyping])

  function updateStreamingMessage(messageId: string, text: string, isComplete = false) {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, text, isStreaming: !isComplete } : msg))
    )
  }

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || loading || isStreaming) return

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: trimmed, ts: Date.now() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const aiMessageId = crypto.randomUUID()
    const aiMsg: ChatMessage = { id: aiMessageId, role: 'assistant', text: '', ts: Date.now(), isStreaming: true }
    setMessages((prev) => [...prev, aiMsg])

    try {
      setIsStreaming(true)
      
      // Use simulated streaming instead of real SSE
      const data = await sendSimulatedStreamingMessage(
        trimmed, 
        [...messages, userMsg], // include the just-sent user message in history
        (text) => { updateStreamingMessage(aiMessageId, text) },
        (typing) => { setIsTyping(typing) }
      )
      
      updateStreamingMessage(aiMessageId, data.reply, true)
      
      if (data.cta) {
        setMessages((prev) => prev.map((msg) => (msg.id === aiMessageId ? { ...msg, cta: data.cta || null } : msg)))
      }
      
    } catch (error) {
      console.error('Simulated streaming failed:', error)
      updateStreamingMessage(aiMessageId, `Error reaching server: ${getErrorMessage(error)}`, true)
    } finally {
      setLoading(false)
      setIsStreaming(false)
      setIsTyping(false)
    }
  }

  function signOut() {
    tokenStore.clear()
    setAuth(null)
    setShowSell(false)
    setShowBuy(false)
  }

  function isSellCTA(btn: CTAButton): boolean {
    if (!btn) return false
    if (btn.id === 'start_sell') return true
    const url = String(btn.url || '').toLowerCase()
    const sellPatterns = [/\/sell($|\/|\?|#)/, /chatbramp\.com\/sell/, /localhost.*\/sell/, /sell\.html?$/, /\bsell\b/]
    return sellPatterns.some((rx) => rx.test(url))
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

  function handleBuyClick(event?: React.MouseEvent) {
    event?.preventDefault()
    if (!auth) {
      setOpenBuyAfterAuth(true)
      setShowSignIn(true)
      return
    }
    setShowBuy(true)
  }

  function echoFromModalToChat(text: string) {
    if (!text) return
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', text, ts: Date.now() }])
  }

  const getLoadingText = () => {
    if (isTyping) return 'Bramp AI is typing…'
    if (isStreaming) return 'Bramp AI is responding…'
    if (thinkingPhase === 'thinking') return 'Bramp AI is thinking…'
    const browsingEmoji = emojiTick % 2 === 0 ? '🌍' : '🪙'
    return `Bramp AI is browsing… ${browsingEmoji}`
  }

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
            <button className="btn" onClick={handleBuyClick} style={{ background: 'var(--primary)', color: 'white' }}>
              Buy
            </button>
            <button className="btn" onClick={handleSellClick} style={{ background: 'var(--primary)', color: 'white' }}>
              Sell
            </button>
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
          onCancel={() => { setShowSignIn(false); setOpenSellAfterAuth(false); setOpenBuyAfterAuth(false) }}
          onSuccess={(res) => {
            setAuth(res)
            setShowSignIn(false)
            setMessages((prev) => [...prev, {
              id: crypto.randomUUID(),
              role: 'assistant',
              text: `You're in, ${res.user.username || (res.user as any).firstname || 'there'}!`,
              ts: Date.now(),
            }])
            if (openSellAfterAuth) { setOpenSellAfterAuth(false); setShowSell(true) }
            if (openBuyAfterAuth)  { setOpenBuyAfterAuth(false);  setShowBuy(true) }
          }}
        />
      ) : showSignUp ? (
        <SignUp
          onCancel={() => setShowSignUp(false)}
          onSuccess={(_res: SignUpResult) => {
            setShowSignUp(false)
            setMessages((prev) => [...prev, {
              id: crypto.randomUUID(),
              role: 'assistant',
              text: 'Account created. Please verify OTP to complete your signup.',
              ts: Date.now(),
            }])
            setShowSignIn(true)
          }}
        />
      ) : (
        <main className="chat">
          <div className="messages">
            {messages.map((m) => (
              <div key={m.id} className={`bubble ${m.role}`}>
                <div className="role">
                  {m.role === 'user' ? 'You' : 'Bramp AI'}
                  {m.isStreaming && (
                    <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.6, fontStyle: 'italic' }}>typing…</span>
                  )}
                </div>
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
                              style={
                                btn.style === 'primary'
                                  ? undefined
                                  : { background: 'transparent', border: '1px solid var(--border)', color: 'var(--txt)' }
                              }
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
                            style={
                              btn.style === 'primary'
                                ? undefined
                                : { background: 'transparent', border: '1px solid var(--border)', color: 'var(--txt)' }
                            }
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
            {(loading || isStreaming || isTyping) && <div className="typing">{getLoadingText()}</div>}
            <div ref={endRef} />
          </div>

          <form className="composer" onSubmit={sendMessage}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isStreaming || isTyping ? 'Please wait…' : 'Try: Sell 100 USDT to NGN'}
              autoFocus
              disabled={isStreaming || isTyping}
            />
            <button className="btn" disabled={loading || isStreaming || isTyping || !input.trim()}>
              {isTyping ? 'AI typing…' : isStreaming ? 'Streaming…' : loading ? 'Sending…' : 'Send'}
            </button>
          </form>

          <div className="hints">
            <span className="hint" onClick={() => !(isStreaming || isTyping) && setInput('Sell 100 USDT to NGN')}>Sell 100 USDT to NGN</span>
            <span className="hint" onClick={() => !(isStreaming || isTyping) && setInput('Show my portfolio balance')}>Show my portfolio balance</span>
            <span className="hint" onClick={() => !(isStreaming || isTyping) && setInput('Current NGN rates')}>Current NGN rates</span>
          </div>
        </main>
      )}

      {/* Modals */}
      <SellModal open={showSell} onClose={() => setShowSell(false)} onChatEcho={echoFromModalToChat} />
      <BuyModal  open={showBuy}  onClose={() => setShowBuy(false)}  onChatEcho={echoFromModalToChat} />

      <footer className="footer">
        <a href="https://drive.google.com/file/d/11qmXGhossotfF4MTfVaUPac-UjJgV42L/view?usp=drive_link" target="_blank" rel="noopener noreferrer">AML/CFT Policy</a>
        <a href="https://drive.google.com/file/d/1FjCZHHg0KoOq-6Sxx_gxGCDhLRUrFtw4/view?usp=sharing" target="_blank" rel="noopener noreferrer">Risk Disclaimer</a>
        <a href="https://drive.google.com/file/d/1brtkc1Tz28Lk3Xb7C0t3--wW7829Txxw/view?usp/drive_link" target="_blank" rel="noopener noreferrer">Privacy</a>
        <a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a>
      </footer>
    </div>
  )
}
