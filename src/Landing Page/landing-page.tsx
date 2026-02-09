import React, { useState, useEffect, useRef } from 'react'
import { Youtube, Instagram, Twitter, BookOpen } from 'lucide-react'
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

  // Features section: typewriter when in view
  const featuresText = "Fund Crypto, Spend Naira"
  const [featuresDisplayedText, setFeaturesDisplayedText] = useState('')
  const [featuresShowCursor, setFeaturesShowCursor] = useState(true)
  const [featuresSectionInView, setFeaturesSectionInView] = useState(false)
  const featuresSectionRef = useRef<HTMLElement>(null)
  const featuresHasAnimated = useRef(false)

  // Third section: typewriter when in view
  const thirdSectionText = "One Wallet For Everything..."
  const [thirdDisplayedText, setThirdDisplayedText] = useState('')
  const [thirdShowCursor, setThirdShowCursor] = useState(true)
  const [thirdSectionInView, setThirdSectionInView] = useState(false)
  const thirdSectionRef = useRef<HTMLElement>(null)
  const thirdHasAnimated = useRef(false)

  // Fifth section: typewriter when in view, same green accent as fourth
  const fifthSectionText = "Make Payments in Seconds at Retail Stores."
  const [fifthDisplayedText, setFifthDisplayedText] = useState('')
  const [fifthShowCursor, setFifthShowCursor] = useState(true)
  const [fifthSectionInView, setFifthSectionInView] = useState(false)
  const fifthSectionRef = useRef<HTMLElement>(null)
  const fifthHasAnimated = useRef(false)

  useEffect(() => {
    // Show Lottie animation after title appears (1s animation + 0.5s delay)
    const timer = setTimeout(() => {
      setShowLottie(true)
    }, 1500)
    
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    // Update theme-color meta tag based on device preference
    const updateThemeColor = () => {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const metaThemeColor = document.querySelector('meta[name="theme-color"]')
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', isDark ? '#121212' : '#FFFFFF')
      }
    }

    updateThemeColor()
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', updateThemeColor)
    
    return () => mediaQuery.removeEventListener('change', updateThemeColor)
  }, [])

  useEffect(() => {
    // Load Tawk.to widget
    if (window.Tawk_API) return // Already loaded

    const TAWK_PROPERTY_ID = import.meta.env.VITE_TAWK_PROPERTY_ID || '68ff552f1a60b619594aac17'
    const TAWK_WIDGET_ID = import.meta.env.VITE_TAWK_WIDGET_ID || '1j8im9gmc'

    window.Tawk_API = window.Tawk_API || {}
    window.Tawk_LoadStart = new Date()

    const script = document.createElement('script')
    script.async = true
    script.src = `https://embed.tawk.to/${TAWK_PROPERTY_ID}/${TAWK_WIDGET_ID}`
    script.charset = 'UTF-8'
    script.setAttribute('crossorigin', '*')
    
    const firstScript = document.getElementsByTagName('script')[0]
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript)
    } else {
      document.body.appendChild(script)
    }
  }, [])

  // Typewriter effect for container text
  useEffect(() => {
    if (containerHasAnimated.current) return
    
    // Start after the main title appears (1s animation + 0.5s delay)
    const delay = 1500
    
    containerHasAnimated.current = true
    let currentIndex = 0
    const typingSpeed = 80 // milliseconds per character
    let typingTimer: ReturnType<typeof setTimeout> | null = null

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

  // Intersection Observer: detect when Features section is in view
  useEffect(() => {
    const section = featuresSectionRef.current
    if (!section) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setFeaturesSectionInView(true)
            // Reset so typewriter can run again when section comes back into view
            setFeaturesDisplayedText('')
            setFeaturesShowCursor(true)
            featuresHasAnimated.current = false
          } else {
            setFeaturesSectionInView(false)
          }
        })
      },
      { threshold: 0.3 }
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  // Typewriter for Features section when in view
  useEffect(() => {
    if (!featuresSectionInView || featuresHasAnimated.current) return

    let currentIndex = 0
    const typingSpeed = 100
    let typingTimer: ReturnType<typeof setTimeout> | null = null

    const typeWriter = () => {
      if (currentIndex < featuresText.length) {
        setFeaturesDisplayedText(featuresText.slice(0, currentIndex + 1))
        currentIndex++
        typingTimer = setTimeout(typeWriter, typingSpeed)
      } else {
        featuresHasAnimated.current = true
        setTimeout(() => setFeaturesShowCursor(false), 800)
      }
    }

    const startTimer = setTimeout(typeWriter, 200)

    return () => {
      clearTimeout(startTimer)
      if (typingTimer) clearTimeout(typingTimer)
    }
  }, [featuresSectionInView, featuresText])

  // Intersection Observer: detect when Third section is in view
  useEffect(() => {
    const section = thirdSectionRef.current
    if (!section) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setThirdSectionInView(true)
            setThirdDisplayedText('')
            setThirdShowCursor(true)
            thirdHasAnimated.current = false
          } else {
            setThirdSectionInView(false)
          }
        })
      },
      { threshold: 0.3 }
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  // Typewriter for Third section when in view
  useEffect(() => {
    if (!thirdSectionInView || thirdHasAnimated.current) return

    let currentIndex = 0
    const typingSpeed = 100
    let typingTimer: ReturnType<typeof setTimeout> | null = null

    const typeWriter = () => {
      if (currentIndex < thirdSectionText.length) {
        setThirdDisplayedText(thirdSectionText.slice(0, currentIndex + 1))
        currentIndex++
        typingTimer = setTimeout(typeWriter, typingSpeed)
      } else {
        thirdHasAnimated.current = true
        setTimeout(() => setThirdShowCursor(false), 800)
      }
    }

    const startTimer = setTimeout(typeWriter, 200)

    return () => {
      clearTimeout(startTimer)
      if (typingTimer) clearTimeout(typingTimer)
    }
  }, [thirdSectionInView, thirdSectionText])

  // Intersection Observer: detect when Fifth section is in view
  useEffect(() => {
    const section = fifthSectionRef.current
    if (!section) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setFifthSectionInView(true)
            setFifthDisplayedText('')
            setFifthShowCursor(true)
            fifthHasAnimated.current = false
          } else {
            setFifthSectionInView(false)
          }
        })
      },
      { threshold: 0.3 }
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  // Typewriter for Fifth section when in view
  useEffect(() => {
    if (!fifthSectionInView || fifthHasAnimated.current) return

    let currentIndex = 0
    const typingSpeed = 100
    let typingTimer: ReturnType<typeof setTimeout> | null = null

    const typeWriter = () => {
      if (currentIndex < fifthSectionText.length) {
        setFifthDisplayedText(fifthSectionText.slice(0, currentIndex + 1))
        currentIndex++
        typingTimer = setTimeout(typeWriter, typingSpeed)
      } else {
        fifthHasAnimated.current = true
        setTimeout(() => setFifthShowCursor(false), 800)
      }
    }

    const startTimer = setTimeout(typeWriter, 200)

    return () => {
      clearTimeout(startTimer)
      if (typingTimer) clearTimeout(typingTimer)
    }
  }, [fifthSectionInView, fifthSectionText])

  return (
    <div className="landing-page">
      {/* Top bar: nav + ticker — fixed, not scrollable */}
      <header className="landing-top-bar">
        <nav className="landing-nav">
          <div className="landing-nav-container">
            <img src="/app-icon.png" alt="Bramp" className="landing-nav-logo" />
            <div className="landing-nav-links">
              <a href="#philosophy" className="landing-nav-link">Philosophy</a>
              <span className="landing-nav-separator" aria-hidden="true">|</span>
              <a href="#features" className="landing-nav-link">Features</a>
              <span className="landing-nav-separator" aria-hidden="true">|</span>
              <a href="/faq.html" className="landing-nav-link">FAQs</a>
              <span className="landing-nav-separator" aria-hidden="true">|</span>
              <a href="/support.html" className="landing-nav-link">Support</a>
            </div>
          </div>
        </nav>
        <PriceTicker />
      </header>

      <section id="download" className="landing-section landing-section-hero">
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
            <a href="https://play.google.com/store/apps/details?id=com.manniegenie.chatbramp" target="_blank" rel="noopener noreferrer" className="landing-badge landing-badge-google-play">
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
            </a>
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSckzac4-IH2ePdb9MRy_CcZOlmoJ7260xeCBjWnm3vcCxiMxg/viewform?usp=header" target="_blank" rel="noopener noreferrer" className="landing-badge landing-badge-app-store">
              <div className="landing-badge-icon-wrapper">
                <svg className="landing-apple-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 17 2.94 12.45 4.7 9.39C5.57 7.87 7.13 6.91 8.82 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/>
                </svg>
              </div>
              <div className="landing-badge-text">
                <span className="landing-badge-label">Download on the</span>
                <span className="landing-badge-name">App Store</span>
              </div>
            </a>
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

      {/* Next section - accent background (Features) */}
      <section ref={featuresSectionRef} id="features" className="landing-section landing-section-next" aria-label="Features">
        <div className="landing-container">
          <h2 className="landing-section-next-title">
            {featuresDisplayedText.length <= 5 ? (
              featuresDisplayedText
            ) : featuresDisplayedText.length <= 11 ? (
              <>Fund <span className="features-highlight">{featuresDisplayedText.slice(5)}</span></>
            ) : featuresDisplayedText.length <= 19 ? (
              <>Fund <span className="features-highlight">Crypto</span>{featuresDisplayedText.slice(11)}</>
            ) : (
              <>Fund <span className="features-highlight">Crypto</span>, Spend <span className="features-highlight">{featuresDisplayedText.slice(19)}</span></>
            )}
            {featuresShowCursor && <span className="typewriter-cursor">|</span>}
          </h2>
          <img src="/IMG_0322.PNG" alt="Fund Crypto, Spend Naira - Bramp app portfolio" className="landing-features-app-img" />
        </div>
      </section>

      {/* Third section - black background, green & white text */}
      <section ref={thirdSectionRef} id="third" className="landing-section landing-section-third" aria-label="One Wallet">
        <div className="landing-container">
          <h2 className="landing-section-third-title">
            {thirdDisplayedText.length <= 4 ? (
              thirdDisplayedText
            ) : thirdDisplayedText.length <= 11 ? (
              <>One <span className="third-section-highlight">{thirdDisplayedText.slice(4)}</span></>
            ) : thirdDisplayedText.length <= 15 ? (
              <>One <span className="third-section-highlight">Wallet</span>{thirdDisplayedText.slice(11)}</>
            ) : (
              <>One <span className="third-section-highlight">Wallet</span> For <span className="third-section-highlight">{thirdDisplayedText.slice(15)}</span></>
            )}
            {thirdShowCursor && <span className="typewriter-cursor">|</span>}
          </h2>
          <div className="landing-section-third-lottie">
            <DotLottieReact
              src="https://lottie.host/27f006e7-26d4-4a34-a833-cd2ffa3bc8e8/FoivP3FZFd.lottie"
              loop
              autoplay
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>
      </section>

      {/* Fourth section - images only, same green accent design */}
      <section id="deposit-send" className="landing-section landing-section-next" aria-label="Deposit and Send">
        <div className="landing-container">
          <div className="landing-section-fourth-images">
            <img src="/IMG_0324.PNG" alt="Select Token - Bramp app" className="landing-features-app-img" />
            <img src="/IMG_0325.PNG" alt="Send Payment - Bramp app" className="landing-features-app-img" />
          </div>
        </div>
      </section>

      {/* Fifth section - same green accent as fourth */}
      <section ref={fifthSectionRef} id="payments" className="landing-section landing-section-next" aria-label="Make Payments in Seconds at Retail Stores">
        <div className="landing-container">
          <h2 className="landing-section-next-title">
            {fifthDisplayedText.length <= 17 ? (
              fifthDisplayedText
            ) : fifthDisplayedText.length <= 25 ? (
              <>Make Payments in <span className="features-highlight">{fifthDisplayedText.slice(17)}</span></>
            ) : fifthDisplayedText.length <= 28 ? (
              <>Make Payments in <span className="features-highlight">Seconds</span>{fifthDisplayedText.slice(25)}</>
            ) : (
              <>Make Payments in <span className="features-highlight">Seconds</span> at <span className="features-highlight">{fifthDisplayedText.slice(28)}</span></>
            )}
            {fifthShowCursor && <span className="typewriter-cursor">|</span>}
          </h2>
          <img src="/craig-lovelidge-v1UDAHfmdZ8-unsplash.jpg" alt="Retail store - Make payments in seconds" className="landing-features-app-img" />
        </div>
      </section>

      {/* Footer - black background, nav links + Download + social media */}
      <footer className="landing-footer">
        <div className="landing-footer-container">
          <div className="landing-footer-nav">
            <a href="#philosophy" className="landing-footer-link">Philosophy</a>
            <span className="landing-footer-separator" aria-hidden="true">|</span>
            <a href="#features" className="landing-footer-link">Features</a>
            <span className="landing-footer-separator" aria-hidden="true">|</span>
            <a href="/faq.html" className="landing-footer-link">FAQs</a>
            <span className="landing-footer-separator" aria-hidden="true">|</span>
            <a href="/support.html" className="landing-footer-link">Support</a>
          </div>
          <div className="landing-footer-legal">
            <a href="/privacy.html" className="landing-footer-link">Privacy Policy</a>
            <span className="landing-footer-separator" aria-hidden="true">|</span>
            <a href="/aml-cft.html" className="landing-footer-link">AML CFT Policy</a>
          </div>
          <div className="landing-footer-social">
            <a href="https://m.youtube.com/@Chatbramp" target="_blank" rel="noopener noreferrer" className="landing-footer-social-link" aria-label="YouTube">
              <Youtube size={20} />
              <span>YouTube</span>
            </a>
            <a href="https://x.com/chatbramp?s=21" target="_blank" rel="noopener noreferrer" className="landing-footer-social-link" aria-label="X (Twitter)">
              <Twitter size={20} />
              <span>X</span>
            </a>
            <a href="https://www.instagram.com/chatbramp?igsh=ZzEwMjFkeXViOW8=" target="_blank" rel="noopener noreferrer" className="landing-footer-social-link" aria-label="Instagram">
              <Instagram size={20} />
              <span>Instagram</span>
            </a>
            <a href="https://medium.com/@chatbramp/article-1-introduction-e8f86489e6d4" target="_blank" rel="noopener noreferrer" className="landing-footer-social-link" aria-label="Medium">
              <BookOpen size={20} />
              <span>Medium</span>
            </a>
          </div>
          <div className="landing-footer-badges">
            <a href="https://play.google.com/store/apps/details?id=com.manniegenie.chatbramp" target="_blank" rel="noopener noreferrer" className="landing-footer-badge landing-footer-badge-google">
              <svg className="landing-play-icon" viewBox="0 0 24 24" fill="none">
                <path d="M3 20.5V3.5C3 2.91 3.34 2.39 3.84 2.15L13.69 12L3.84 21.85C3.34 21.61 3 21.09 3 20.5Z" fill="#00D95F"/>
                <path d="M16.81 15.12L6.05 21.34L14.54 12.85L16.81 15.12Z" fill="#FFDA2D"/>
                <path d="M3.84 2.15C4.03 2.06 4.23 2 4.45 2C4.66 2 4.87 2.06 5.05 2.15L15.81 8.38L13.69 12L3.84 2.15Z" fill="#FF3E3E"/>
                <path d="M16.81 8.88L19.96 10.75C20.54 11.07 21 11.7 21 12.5C21 13.3 20.54 13.93 19.96 14.25L16.81 16.12L14.54 13.85L16.81 8.88Z" fill="#4C8BF5"/>
              </svg>
              <span>Get on Android</span>
            </a>
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSckzac4-IH2ePdb9MRy_CcZOlmoJ7260xeCBjWnm3vcCxiMxg/viewform?usp=header" target="_blank" rel="noopener noreferrer" className="landing-footer-badge landing-footer-badge-apple">
              <svg className="landing-apple-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 17 2.94 12.45 4.7 9.39C5.57 7.87 7.13 6.91 8.82 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/>
              </svg>
              <span>Get on iOS</span>
            </a>
          </div>
          <p className="landing-footer-copyright">© {new Date().getFullYear()} Bramp Africa Limited. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
