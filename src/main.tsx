// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

  //
  // Inject Google Fonts <link> tags (so you don't have to touch index.html)
  //
  ; (function injectSFFonts() {
    // avoid duplicates if HMR reloads
    if (document.querySelector('link[href*="family=SF+Pro+Display"]')) return

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
      'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=JetBrains+Mono:wght@100..800&display=swap'

    document.head.append(preconnect1, preconnect2, stylesheet)
  })()


//
// --- Prevent unwanted zooming while maintaining usability ---
//
const BASE_VIEWPORT = 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover'

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

// Initialize viewport with zoom restrictions
getOrCreateViewportMeta()

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// Double-tap prevention
document.addEventListener('touchend', (e) => {
  const now = Date.now()
  const DOUBLE_TAP_DELAY = 300

  if (document.documentElement.hasAttribute('data-last-tap')) {
    const lastTap = parseInt(document.documentElement.getAttribute('data-last-tap') || '0')
    if (now - lastTap < DOUBLE_TAP_DELAY) {
      e.preventDefault()
    }
  }

  document.documentElement.setAttribute('data-last-tap', now.toString())
}, { passive: false })

// Prevent pinch zoom on touch devices
document.addEventListener('gesturestart', (e) => {
  e.preventDefault()
}, { passive: false })

document.addEventListener('gesturechange', (e) => {
  e.preventDefault()
}, { passive: false })

document.addEventListener('gestureend', (e) => {
  e.preventDefault()
}, { passive: false })

// HMR cleanup (Vite)
const hot = (import.meta as any).hot as { dispose(cb: () => void): void } | undefined
if (hot) {
  hot.dispose(() => {
    // Clean up event listeners
    document.removeEventListener('touchend', () => { })
    document.removeEventListener('gesturestart', () => { })
    document.removeEventListener('gesturechange', () => { })
    document.removeEventListener('gestureend', () => { })
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
    createRoot(root).render(<MobileApp />)
  }).catch((err) => {
    console.error('Failed to load Mobile App:', err)
    // Fallback to desktop app if mobile fails
    import('./App').then(({ default: App }) => {
      createRoot(root).render(<App />)
    })
  })
} else {
  console.log('🖥️ Loading Desktop App...')

  // Load desktop app
  import('./App').then(({ default: App }) => {
    createRoot(root).render(<App />)
  }).catch((err) => {
    console.error('Failed to load Desktop App:', err)
  })
}
