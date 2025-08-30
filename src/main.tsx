// src/main.tsx
import React, { StrictMode, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

// 👉 lazy-load the two roots
const DesktopApp = React.lazy(() => import('./App'))
const MobileApp  = React.lazy(() => import('./Screen'))

// 👇 choose your breakpoint (px)
const MOBILE_MAX_WIDTH = 768

// ---- Google Fonts injection (unchanged) ----
;(function injectGeistLinks() {
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
  stylesheet.href = 'https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap'
  document.head.append(preconnect1, preconnect2, stylesheet)
})()

// ---- iOS focus zoom guard (unchanged) ----
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
  return tag === 'input' || tag === 'select' || tag === 'textarea' || (el as HTMLElement).isContentEditable === true
}
const onFocusIn = (e: FocusEvent) => { if (isEditable(e.target as Element | null)) setViewportNoZoom(true) }
const onFocusOut = (e: FocusEvent) => { if (isEditable(e.target as Element | null)) setViewportNoZoom(false) }
window.addEventListener('focusin', onFocusIn)
window.addEventListener('focusout', onFocusOut)
if (isEditable(document.activeElement)) setViewportNoZoom(true)
const hot = (import.meta as any).hot as { dispose(cb: () => void): void } | undefined
if (hot) {
  hot.dispose(() => {
    window.removeEventListener('focusin', onFocusIn)
    window.removeEventListener('focusout', onFocusOut)
    setViewportNoZoom(false)
  })
}

// ---- Mobile/Desktop router ----
function useIsMobile() {
  const mqStr = `(max-width: ${MOBILE_MAX_WIDTH}px)`
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(mqStr).matches)
  useEffect(() => {
    const mq = window.matchMedia(mqStr)
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    if (mq.addEventListener) mq.addEventListener('change', onChange)
    else mq.addListener(onChange) // Safari legacy
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange)
      else mq.removeListener(onChange)
    }
  }, [mqStr])
  return isMobile
}

function RootRouter() {
  const isMobile = useIsMobile()
  return (
    <Suspense fallback={null}>
      {isMobile ? <MobileApp /> : <DesktopApp />}
    </Suspense>
  )
}

// ---- Mount ----
// NOTE: do NOT import './index.css' here.
// Put desktop styles in App.tsx:      import './index.css'
// Put mobile styles in mobile.tsx:    import './mobile.css'
const rootEl = document.getElementById('root')!
createRoot(rootEl).render(
  <StrictMode>
    <RootRouter />
  </StrictMode>
)
