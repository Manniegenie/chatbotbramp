import React, { useState, useEffect, useRef } from 'react'
import { Download } from 'lucide-react'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import './landing-page.css'
import PriceTicker from './PriceTicker'

export default function LandingPage() {
  const textBefore = "Flip Your Crypto to Cash and "
  const textAccent = "Back!"
  const [showLottie, setShowLottie] = useState(false)
  
  // Split text into parts: "Flip " | "Your" | " Crypto to Cash " | "and " | "Back!"
  const part1 = "Flip "
  const part2 = "Your"
  const part3 = " Crypto to Cash "
  const part4 = "and "

  // Typewriter effect for white container text
  const containerText = "Send 20000 naira to Henry's Opay"
  const [displayedContainerText, setDisplayedContainerText] = useState('')
  const [showContainerCursor, setShowContainerCursor] = useState(true)
  const containerHasAnimated = useRef(false)
  const [sendButtonClicked, setSendButtonClicked] = useState(false)

  useEffect(() => {
    // Show Lottie animation after title appears (1s animation + 0.5s delay)
    const timer = setTimeout(() => {
      setShowLottie(true)
    }, 1500)
    
    return () => clearTimeout(timer)
  }, [])

  // Typewriter effect for container text
  useEffect(() => {
    if (containerHasAnimated.current) return
    
    // Start after the main title appears (1s animation + 0.5s delay)
    const delay = 1500
    
    containerHasAnimated.current = true
    let currentIndex = 0
    const typingSpeed = 80 // milliseconds per character
    let typingTimer: NodeJS.Timeout | null = null

    const typeWriter = () => {
      if (currentIndex < containerText.length) {
        setDisplayedContainerText(containerText.slice(0, currentIndex + 1))
        currentIndex++
        typingTimer = setTimeout(typeWriter, typingSpeed)
      } else {
        // Hide cursor after animation completes
        setTimeout(() => {
          setShowContainerCursor(false)
          // Auto-click send button after text finishes
          setTimeout(() => {
            setSendButtonClicked(true)
            setTimeout(() => setSendButtonClicked(false), 300)
          }, 500)
        }, 1000)
      }
    }

    const startTimer = setTimeout(typeWriter, delay)
    
    return () => {
      clearTimeout(startTimer)
      if (typingTimer) clearTimeout(typingTimer)
    }
  }, [containerText])

  return (
    <div className="landing-page">
      {/* Top Navigation Menu */}
      <nav className="landing-nav">
        <div className="landing-nav-container">
          <img src="/app-icon.png" alt="Bramp" className="landing-nav-logo" />
          <div className="landing-nav-links">
            <a href="#philosophy" className="landing-nav-link">
              <img src="/icons/philosophy.png" alt="Philosophy" className="landing-nav-link-icon" />
              Philosophy
            </a>
            <a href="#features" className="landing-nav-link">
              <img src="/icons/jigsaw.png" alt="Features" className="landing-nav-link-icon" />
              Features
            </a>
            <a href="#faqs" className="landing-nav-link">
              <img src="/icons/chat.png" alt="FAQs" className="landing-nav-link-icon" />
              FAQs
            </a>
          </div>
          <button className="landing-nav-download">
            <Download size={16} />
            <span>Download</span>
          </button>
        </div>
      </nav>

      {/* Price Ticker */}
      <PriceTicker />

      {/* Decorative Icons */}
      <div className="landing-decorative-icons">
        {/* Bitcoin */}
        <img src="/icons/btc-icon.png?v=2" alt="Bitcoin" className="decorative-icon decorative-icon-1" />
        {/* Ethereum */}
        <img src="/icons/eth-icon.png?v=2" alt="Ethereum" className="decorative-icon decorative-icon-2" />
        {/* Solana */}
        <img src="/icons/sol-icon.png?v=2" alt="Solana" className="decorative-icon decorative-icon-3" />
        {/* USDT */}
        <img src="/icons/usdt-icon.png?v=2" alt="USDT" className="decorative-icon decorative-icon-4" />
        {/* USDC */}
        <img src="/icons/usdc-icon.png?v=2" alt="USDC" className="decorative-icon decorative-icon-5" />
        {/* NGN - Mobile replacement for USDC */}
        <img src="/icons/NGNZ.png?v=2" alt="NGN" className="decorative-icon decorative-icon-5-mobile" />
        {/* BNB */}
        <img src="/icons/bnb-icon.png?v=2" alt="BNB" className="decorative-icon decorative-icon-6" />
        {/* MATIC */}
        <img src="/icons/matic-icon.png?v=2" alt="MATIC" className="decorative-icon decorative-icon-7" />
        {/* Tron */}
        <img src="/icons/Tron.png?v=2" alt="Tron" className="decorative-icon decorative-icon-8" />
        {/* NGN */}
        <img src="/icons/NGNZ.png?v=2" alt="NGN" className="decorative-icon decorative-icon-9" />
        {/* AVAX */}
        <img src="/icons/avax-icon.png?v=2" alt="AVAX" className="decorative-icon decorative-icon-10" />
        {/* DOGE */}
        <img src="/icons/doge-icon.png?v=2" alt="DOGE" className="decorative-icon decorative-icon-11" />
      </div>

      <section className="landing-section landing-section-hero">
        <div className="landing-container">
          <h1 className="landing-hero-title">
            <span className="landing-title-placeholder" aria-hidden="true">Flip Your Crypto to Cash <br />and Back!</span>
            <span className="landing-title-content">
              {part1}
              <span className="landing-hero-accent">{part2}</span>
              {part3}
              <br />
              {part4}
              <span className="landing-hero-accent">{textAccent}</span>
              {showLottie && (
                <span className="landing-lottie-animation">
                  <DotLottieReact
                    src="https://lottie.host/19969e37-481f-4c95-a087-d3b646d00b16/YgfV82zZok.lottie"
                    loop
                    autoplay
                    style={{ width: '100%', height: '100%' }}
                  />
                </span>
              )}
            </span>
          </h1>
          <div className="landing-download-badges">
            <div className="landing-badge landing-badge-google-play">
              <div className="landing-badge-icon-wrapper">
                <svg className="landing-play-icon" viewBox="0 0 24 24" fill="none">
                  <path d="M3 20.5V3.5C3 2.91 3.34 2.39 3.84 2.15L13.69 12L3.84 21.85C3.34 21.61 3 21.09 3 20.5Z" fill="#00D95F"/>
                  <path d="M16.81 15.12L6.05 21.34L14.54 12.85L16.81 15.12Z" fill="#FFDA2D"/>
                  <path d="M3.84 2.15C4.03 2.06 4.23 2 4.45 2C4.66 2 4.87 2.06 5.05 2.15L15.81 8.38L13.69 12L3.84 2.15Z" fill="#FF3E3E"/>
                  <path d="M16.81 8.88L19.96 10.75C20.54 11.07 21 11.7 21 12.5C21 13.3 20.54 13.93 19.96 14.25L16.81 16.12L14.54 13.85L16.81 8.88Z" fill="#4C8BF5"/>
                </svg>
              </div>
              <div className="landing-badge-text">
                <span className="landing-badge-label">Get it on</span>
                <span className="landing-badge-name">Google Play</span>
              </div>
            </div>
            <div className="landing-badge landing-badge-app-store">
              <div className="landing-badge-icon-wrapper">
                <svg className="landing-apple-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 17 2.94 12.45 4.7 9.39C5.57 7.87 7.13 6.91 8.82 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/>
                </svg>
              </div>
              <div className="landing-badge-text">
                <span className="landing-badge-label">Download on the</span>
                <span className="landing-badge-name">App Store</span>
              </div>
            </div>
          </div>
          <div className="landing-white-container">
            <p className="landing-white-container-text">
              {displayedContainerText}
              {showContainerCursor && <span className="typewriter-cursor">|</span>}
            </p>
            <button 
              className={`landing-send-button ${sendButtonClicked ? 'clicked' : ''}`}
              onClick={() => {
                setSendButtonClicked(true)
                setTimeout(() => setSendButtonClicked(false), 300)
              }}
            >
              <svg className="landing-send-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
