// src/App.tsx
import React from 'react'
import LandingPage from './Landing Page/landing-page'

export default function App() {
  return <LandingPage />
}

// Maintenance page code (commented out for now)
/*
import { motion } from 'framer-motion'
import BrampLogo from './assets/logo.jpeg'
import wallpaper1 from './assets/wallpaper1.jpg'

export default function App() {
  const socialLinks = [
    { name: 'Twitter', url: 'https://x.com/Chatbramp' },
    { name: 'Instagram', url: 'https://www.instagram.com/chatbramp/' },
    { name: 'Medium', url: 'https://medium.com/@chatbramp' },
    { name: 'YouTube', url: 'https://www.youtube.com/@Chatbramp' },
  ]

  return (
    <>
      <style>
        {`
          :root {
            --accent: #007337;
            --text-main: #ffffff;
            --text-muted: #a1a1aa;
          }

          body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #000;
            color: var(--text-main);
          }

          .maintenance-page {
            position: relative;
            height: 100vh;
            width: 100vw;
            display: flex;
            align-items: center;
            justify-content: center;
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
          }

          .overlay {
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 1;
          }

          .content-card {
            position: relative;
            z-index: 10;
            max-width: 480px;
            width: 90%;
            padding: 40px;
            text-align: center;
            background: rgba(20, 20, 20, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.4);
          }

          .logo {
            width: 80px;
            height: 80px;
            border-radius: 20px;
            margin-bottom: 24px;
            box-shadow: 0 8px 16px rgba(0,0,0,0.3);
          }

          h1 {
            font-size: 32px;
            font-weight: 700;
            margin: 0 0 16px 0;
            background: linear-gradient(135deg, #fff 0%, #a1a1aa 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }

          p {
            font-size: 16px;
            line-height: 1.6;
            color: var(--text-muted);
            margin: 0 0 32px 0;
          }

          .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: rgba(0, 115, 55, 0.15);
            border: 1px solid rgba(0, 115, 55, 0.3);
            border-radius: 100px;
            color: #4ade80;
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 24px;
          }

          .status-dot {
            width: 8px;
            height: 8px;
            background-color: #4ade80;
            border-radius: 50%;
            animation: pulse 2s infinite;
          }

          .social-links {
            display: flex;
            justify-content: center;
            gap: 16px;
            flex-wrap: wrap;
            margin-top: 32px;
            padding-top: 32px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
          }

          .social-link {
            color: var(--text-muted);
            text-decoration: none;
            font-size: 14px;
            transition: color 0.2s;
          }

          .social-link:hover {
            color: var(--text-main);
            text-decoration: underline;
          }

          @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.4); }
            70% { box-shadow: 0 0 0 6px rgba(74, 222, 128, 0); }
            100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
          }
        `}
      </style>

      <div 
        className="maintenance-page"
        style={{ backgroundImage: `url(${wallpaper1})` }}
      >
        <div className="overlay" />
        
        <motion.div 
          className="content-card"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <img src={BrampLogo} alt="Bramp" className="logo" />
          
          <div className="status-badge">
            <div className="status-dot" />
            System Maintenance
          </div>

          <h1>We'll be back soon</h1>
          
          <p>
            We're currently performing scheduled maintenance to improve the Bramp experience. 
            Services are temporarily unavailable on desktop, but we expect to be back online shortly, but you can try mobile.
          </p>

          <div className="social-links">
            {socialLinks.map((link) => (
              <a 
                key={link.name} 
                href={link.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="social-link"
              >
                {link.name}
              </a>
            ))}
          </div>
        </motion.div>
      </div>
    </>
  )
}
*/