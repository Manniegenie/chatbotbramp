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
  isStreaming?: boolean // Add streaming indicator
}

// Always read the freshest token from secure storage
async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { access } = tokenStore.getTokens()
  const headers = new Headers(init.headers || {})
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (access) headers.set('Authorization', `Bearer ${access}`)
  return fetch(input, { ...init, headers })
}

// Simple streaming client
async function sendStreamingMessage(message: string, history: ChatMessage[], onChunk: (text: string) => void): Promise<any> {
  const response = await authFetch(`${API_BASE}/chatbot/chat/stream`, {
    method: 'POST',
    headers: {
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache'
    },
    body: JSON.stringify({ 
      message, 
      history: history.slice(-10).map(m => ({ role: m.role, text: m.text })),
      sessionId: crypto.randomUUID()
    })
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  if (!response.body) {
    throw new Error('No response body for streaming')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  let metadata = {}

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6)
        if (dataStr === '[DONE]') return { reply: fullText, ...metadata }

        try {
          const data = JSON.parse(dataStr)
          
          if (data.error) {
            throw new Error(data.error)
          }

          if (data.text && data.isStream) {
            fullText += data.text
            onChunk(fullText)
          }

          if (data.complete) {
            return { 
              reply: fullText, 
              cta: data.cta,
              metadata: data.metadata 
            }
          }

        } catch (parseError) {
          console.warn('Failed to parse SSE data:', dataStr)
        }
      }
    }
  }

  return { reply: fullText, ...metadata }
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
    text: "Hey! I'm Bramp AI 🤖🇳🇬 Buy/sell crypto, see rates, and cash out to NGN—right here in chat. Try: 'Sell 100 USDT to NGN' 💸",
    ts: Date.now()
  }])

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  // Enhanced typing indicator with streaming support
  const [thinkingPhase, setThinkingPhase] = useState<'thinking' | 'browsing' | 'streaming'>('thinking')
  const [emojiTick, setEmojiTick] = useState(0)
  const [isStreaming, setIsStreaming] = useState(false) // Add streaming state

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

  // Enhanced thinking phases with streaming support
  useEffect(() => {
    let phaseTimer: number | undefined
    let emojiTimer: number | undefined

    if (loading && !isStreaming) {
      setThinkingPhase('thinking')
      setEmojiTick(0)
      phaseTimer = window.setTimeout(() => setThinkingPhase('browsing'), 2500)

      // While browsing, alternate emojis
      emojiTimer = window.setInterval(() => {
        setEmojiTick(t => (t + 1) % 2)
      }, 600)
    } else if (isStreaming) {
      setThinkingPhase('streaming')
    }

    return () => {
      if (phaseTimer) window.clearTimeout(phaseTimer)
      if (emojiTimer) window.clearInterval(emojiTimer)
    }
  }, [loading, isStreaming])

  // Update streaming message content
  function updateStreamingMessage(messageId: string, text: string, isComplete = false) {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, text, isStreaming: !isComplete }
        : msg
    ))
  }

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || loading || isStreaming) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: trimmed,
      ts: Date.now()
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Create placeholder for AI response
    const aiMessageId = crypto.randomUUID()
    const aiMsg: ChatMessage = {
      id: aiMessageId,
      role: 'assistant',
      text: '',
      ts: Date.now(),
      isStreaming: true
    }
    setMessages(prev => [...prev, aiMsg])

    try {
      // Try streaming first
      setIsStreaming(true)
      const data = await sendStreamingMessage(trimmed, messages, (text) => {
        updateStreamingMessage(aiMessageId, text)
      })

      // Complete the streaming message
      updateStreamingMessage(aiMessageId, data.reply, true)
      
      if (data.cta) {
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId 
            ? { ...msg, cta: data.cta }
            : msg
        ))
      }

    } catch (streamError) {
      console.error('Streaming failed, falling back to regular chat:', streamError)
      
      // Fallback to regular chat
      try {
        updateStreamingMessage(aiMessageId, 'Connecting...', false)
        
        const res = await authFetch(`${API_BASE}/chatbot/chat`, {
          method: 'POST',
          body: JSON.stringify({ 
            message: trimmed, 
            history: messages.slice(-10).map(m => ({ role: m.role, text: m.text })),
            sessionId: crypto.randomUUID()
          })
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        const botText = data?.reply ?? 'Sorry, I could not process that.'

        updateStreamingMessage(aiMessageId, botText, true)
        
        if (data.cta) {
          setMessages(prev => prev.map(msg => 
            msg.id === aiMessageId 
              ? { ...msg, cta: data.cta }
              : msg
          ))
        }

      } catch (err: any) {
        updateStreamingMessage(aiMessageId, `⚠️ Error reaching server: ${err.message}. Network Error.`, true)
      }
    } finally {
      setLoading(false)
      setIsStreaming(false)
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

  // Enhanced emoji display for different phases
  const getLoadingText = () => {
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
                <div className="role">
                  {m.role === 'user' ? 'You' : 'Bramp AI'}
                  {/* Add typing indicator for streaming messages */}
                  {m.isStreaming && (
                    <span style={{ 
                      marginLeft: '8px', 
                      fontSize: '12px', 
                      opacity: 0.6,
                      fontStyle: 'italic'
                    }}>
                      typing…
                    </span>
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
            {(loading || isStreaming) && (
              <div className="typing">
                {getLoadingText()}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form className="composer" onSubmit={sendMessage}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={isStreaming ? "Please wait…" : "Try: Sell 100 USDT to NGN"}
              autoFocus
              disabled={isStreaming} // Disable input during streaming
            />
            <button className="btn" disabled={loading || isStreaming || !input.trim()}>
              {isStreaming ? 'Streaming…' : loading ? 'Sending…' : 'Send'}
            </button>
          </form>

          <div className="hints">
            <span 
              className="hint" 
              onClick={() => !isStreaming && setInput('Sell 100 USDT to NGN')}
            >
              Sell 100 USDT to NGN
            </span>
            <span 
              className="hint" 
              onClick={() => !isStreaming && setInput('Show my portfolio balance')}
            >
              Show my portfolio balance
            </span>
            <span 
              className="hint" 
              onClick={() => !isStreaming && setInput('Withdraw ₦50,000 to GTBank')}
            >
              Withdraw ₦50,000 to GTBank
            </span>
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
          href="https://drive.google.com/file/d/1brtkc1Tz28Lk3Xb7C0t3--wW7829Txxw/view?usp/drive_link"
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