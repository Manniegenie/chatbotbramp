// src/App.tsx
import React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import store from './store';
import ProtectedRoute from './components/ProtectedRoute';
import SignIn from './signin';
import SignUp from './signup';
import SellModal from './sell';
import BrampLogo from './assets/logo.jpeg';

// Placeholder dashboard component
function Dashboard() {
  return (
    <main className="chat">
      <h2>Welcome to Bramp Dashboard</h2>
      {/* Add dashboard content here */}
    </main>
  );
}

function ChatHome() {
  return (
    <main className="chat">
      <h2>Welcome to Bramp AI</h2>
      {/* Add chat home content here */}
    </main>
  );
}

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

type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  ts: number
  cta?: CTA | null
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

// Helper function to get time-based greeting
// const getTimeBasedGreeting = React.useCallback((): string => {
//   const hour = new Date().getHours();
//   if (hour < 12) return 'Good morning';
//   if (hour < 18) return 'Good afternoon';
//   return 'Good evening';
// }, []);

// Always read the freshest token from secure storage
// const isExpiredJwt = React.useCallback((token: string): boolean => {
//   try {
//     const [, payloadB64] = token.split('.')
//     const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
//     const { exp } = JSON.parse(json)
//     return !exp || Date.now() >= exp * 1000
//   } catch { return true }
// }, []);

// Removed unused authFetch and tokenStore references

/* ----------------------- Error helper ----------------------- */
function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try { return JSON.stringify(e) } catch { return String(e) }
}

// Simple API call without streaming
// Removed unused sendChatMessage and API_BASE references

/* ----------------------- Linkify + Markdown-lite helpers ----------------------- */

const URL_REGEX = /https?:\/\/[^\s<>"')]+/gi
const MD_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g

// const shortenUrlForDisplay = React.useCallback((raw: string) => {
//   try {
//     const u = new URL(raw)
//     const host = u.host.replace(/^www\./, '')
//     let path = u.pathname || ''
//     if (path.length > 20) {
//       const segs = path.split('/').filter(Boolean)
//       if (segs.length > 2) path = `/${segs[0]}/…/${segs[segs.length - 1]}`
//     }
//     let label = host + (path === '/' ? '' : path)
//     if (u.search || u.hash) label += '…'
//     return label.length > 48 ? label.slice(0, 45) + '…' : label
//   } catch {
//     return raw.length > 48 ? raw.slice(0, 45) + '…' : raw
//   }
// }, []);

// Removed unused inlineRender and misplaced export

export default function App() {
  return (
    <Provider store={store}>
      <Router>
        <Routes>
          <Route path="/" element={<ChatHome />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          {/* Add more routes as needed */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </Provider>
  );
}
//                 onChange={(e) => setInput(e.target.value)}
//                 placeholder={loading ? 'Please wait…' : 'Try: Sell 100 USDT to NGN'}
//                 autoFocus
//                 disabled={loading}
//               />
//               <button
//                 type="submit"
//                 className="btn"
//                 disabled={loading || !input.trim()}
//                 style={{
//                   width: '44px',
//                   height: '44px',
//                   borderRadius: '50%',
//                   display: 'flex',
//                   alignItems: 'center',
//                   justifyContent: 'center',
//                   padding: '0',
//                   background: loading || !input.trim() ? '#ccc' : 'var(--accent)',
//                   color: 'white',
//                   border: 'none',
//                   cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
//                   transition: 'all 0.2s ease',
//                   boxShadow: loading || !input.trim() ? 'none' : '0 2px 8px rgba(0,115,55,0.18)',
//                   minWidth: '44px',
//                   flexShrink: 0
//                 }}
//                 onMouseEnter={(e) => {
//                   if (!loading && input.trim()) {
//                     e.currentTarget.style.transform = 'scale(1.05)'
//                     e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,115,55,0.26)'
//                   }
//                 }}
//                 onMouseLeave={(e) => {
//                   e.currentTarget.style.transform = 'scale(1)'
//                   e.currentTarget.style.boxShadow = loading || !input.trim() ? 'none' : '0 2px 8px rgba(0,115,55,0.18)'
//                 }}
//               >
//                 {loading ? (
//                   <div style={{
//                     width: '16px',
//                     height: '16px',
//                     border: '2px solid transparent',
//                     borderTop: '2px solid white',
//                     borderRadius: '50%',
//                     animation: 'spin 1s linear infinite'
//                   }} />
//                 ) : (
//                   <svg
//                     width="18"
//                     height="18"
//                     viewBox="0 0 24 24"
//                     fill="none"
//                     stroke="white"
//                     strokeWidth="2"
//                     strokeLinecap="round"
//                     strokeLinejoin="round"
//                   >
//                     <line x1="22" y1="2" x2="11" y2="13" />
//                     <polygon points="22,2 15,22 11,13 2,9" />
//                   </svg>
//                 )}
//               </button>
//             </form>

//             <div className="hints">
//               <span className="hint" onClick={() => handleHintClick('Sell 100 USDT to NGN')}>Sell 100 USDT to NGN</span>
//               <span className="hint" onClick={() => handleHintClick('Show my portfolio balance')}>Show my portfolio balance</span>
//               <span className="hint" onClick={() => handleHintClick('Current NGN rates')}>Current NGN rates</span>
//             </div>
//           </main>
//         )}

//         <SellModal open={showSell} onClose={() => setShowSell(false)} onChatEcho={echoFromModalToChat} />

//         <footer className="footer">
//           <div className="footer-left">
//             <div className="footer-links">
//               <a href="https://drive.google.com/file/d/11qmXGhossotfF4MTfVaUPac-UjJgV42L/view?usp=drive_link" target="_blank" rel="noopener noreferrer">AML/CFT Policy</a>
//               <a href="https://drive.google.com/file/d/1FjCZHHg0KoOq-6Sxx_gxGCDhLRUrFtw4/view?usp=sharing" target="_blank" rel="noopener noreferrer">Risk Disclaimer</a>
//               <a href="https://drive.google.com/file/d/1brtkc1Tz28Lk3Xb7C0t3--wW7829Txxw/view?usp=drive_link" target="_blank" rel="noopener noreferrer">Privacy</a>
//               <a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a>
//             </div>
//           </div>

//           <div className="footer-center">
//             <div className="copyright">© 2025 Bramp Africa Limited. Bramp Platforms, LLC.</div>
//           </div>

//           <div className="footer-right">
//             <div className="footer-brand">
//               <img 
//                 src={BrampLogo} 
//                 alt="Bramp Africa Logo" 
//                 width="24" 
//                 height="24"
//                 onError={(e) => {
//                   // Fallback to a placeholder if logo fails to load
//                   e.currentTarget.style.display = 'none';
//                 }}
//               />
//               <span></span>
//             </div>
//           </div>
//         </footer>
//       </div>
//     </>
//   )
// 