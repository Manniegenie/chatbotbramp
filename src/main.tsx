import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Inject Google Fonts <link> tags (so you don't have to touch index.html)
;(function injectGeistLinks() {
  // avoid duplicates if HMR reloads
  if (document.querySelector('link[href*="family=Geist"]')) return

  const preconnect1 = document.createElement('link')
  preconnect1.rel = 'preconnect'
  preconnect1.href = 'https://fonts.googleapis.com'

  const preconnect2 = document.createElement('link')
  preconnect2.rel = 'preconnect'
  preconnect2.href = 'https://fonts.gstatic.com'
  preconnect2.crossOrigin = 'anonymous'

  const stylesheet = document.createElement('link')
  stylesheet.rel = 'stylesheet'
  stylesheet.href =
    'https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap'

  document.head.append(preconnect1, preconnect2, stylesheet)
})()

// --- Prevent iOS focus zoom only while editing (keeps pinch-zoom otherwise) ---
const BASE_VIEWPORT = 'width=device-width, initial-scale=1, viewport-fit=cover'

function getOrCreateViewportMeta(): HTMLMetaElement {
  let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'viewport'
    meta.content = BASE_VIEWPORT
    document.head.appendChild(meta)
  }
  return meta
}

function setViewportNoZoom(active: boolean) {
  const meta = getOrCreateViewportMeta()
  const noZoom = `${BASE_VIEWPORT}, maximum-scale=1, user-scalable=no`
  meta.setAttribute('content', active ? noZoom : BASE_VIEWPORT)
}

function isEditable(el: Element | null) {
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return (
    tag === 'input' ||
    tag === 'select' ||
    tag === 'textarea' ||
    (el as HTMLElement).isContentEditable === true
  )
}

const onFocusIn = (e: FocusEvent) => {
  const t = e.target as Element | null
  if (isEditable(t)) setViewportNoZoom(true)
}

const onFocusOut = (e: FocusEvent) => {
  const t = e.target as Element | null
  if (isEditable(t)) setViewportNoZoom(false)
}

window.addEventListener('focusin', onFocusIn)
window.addEventListener('focusout', onFocusOut)

// If page loads when an input is already focused (rare), ensure no-zoom is active
if (isEditable(document.activeElement)) setViewportNoZoom(true)

// HMR cleanup (Vite)
if ((import.meta as any).hot) {
  ;(import.meta as any).hot.dispose(() => {
    window.removeEventListener('focusin', onFocusIn)
    window.removeEventListener('focusout', onFocusOut)
    setViewportNoZoom(false)
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
