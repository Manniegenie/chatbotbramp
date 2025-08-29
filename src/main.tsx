import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Inject Google Fonts <link> tags (so you don't have to touch index.html)
(function injectGeistLinks() {
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
