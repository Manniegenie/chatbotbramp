// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import bg from './assets/bg.jpg' // <-- import your background image (adjust filename)

//
// Inject Google Fonts <link> tags (so you don't have to touch index.html)
//
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

// --- set background image CSS variable on :root (bundler will resolve the URL) ---
document.documentElement.style.setProperty('--bg-image-url', `url(${bg})`)

//
// --- Prevent iOS focus zoom only while editing (keeps pinch-zoom otherwise) ---
//
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
const hot = (import.meta as any).hot as { dispose(cb: () => void): void } | undefined
if (hot) {
  hot.dispose(() => {
    window.removeEventListener('focusin', onFocusIn)
    window.removeEventListener('focusout', onFocusOut)
    setViewportNoZoom(false)
  })
}

//
// --- Mobile Device Detection & Routing ---
//
function isMobileDevice(): boolean {
  // Check user agent
  const userAgent = navigator.userAgent.toLowerCase()
  const mobileKeywords = [
    'android',
    'iphone',
    'ipad',
    'ipod',
    'blackberry',
    'windows phone',
    'webos',
  ]
  const isMobileUA = mobileKeywords.some((keyword) => userAgent.includes(keyword))

  // Check screen size
  const isSmallScreen = window.innerWidth <= 768

  // Check for touch capability
  const isTouchDevice =
    'ontouchstart' in window || navigator.maxTouchPoints > 0

  // Consider it mobile if it has mobile UA OR (small screen AND touch)
  return isMobileUA || (isSmallScreen && isTouchDevice)
}

// Check for URL parameter overrides (?mobile=true or ?desktop=true)
function getDeviceOverride(): 'mobile' | 'desktop' | null {
  const params = new URLSearchParams(window.location.search)
  if (params.get('mobile') === 'true') return 'mobile'
  if (params.get('desktop') === 'true') return 'desktop'
  return null
}

// Determine which app to load
function shouldLoadMobileApp(): boolean {
  const override = getDeviceOverride()
  if (override === 'mobile') return true
  if (override === 'desktop') return false
  return isMobileDevice()
}

// Root element
const root = document.getElementById('root')!

// Load the appropriate app version
if (shouldLoadMobileApp()) {
  console.log('📱 Loading Mobile App...')
  
  // Dynamically import mobile app
  import('./MobileApp').then(({ default: MobileApp }) => {
    createRoot(root).render(
      <StrictMode>
        <MobileApp />
      </StrictMode>
    )
  }).catch((err) => {
    console.error('Failed to load Mobile App:', err)
    // Fallback to desktop app if mobile fails
    import('./App').then(({ default: App }) => {
      createRoot(root).render(
        <StrictMode>
          <App />
        </StrictMode>
      )
    })
  })
} else {
  console.log('🖥️ Loading Desktop App...')
  
  // Load desktop app
  import('./App').then(({ default: App }) => {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>
    )
  }).catch((err) => {
    console.error('Failed to load Desktop App:', err)
  })
}