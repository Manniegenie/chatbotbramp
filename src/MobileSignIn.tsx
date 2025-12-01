// src/MobileSignIn.tsx
import React, { useState, useEffect } from 'react'
import './mobile-auth.css'

// --- Types ---
export interface User {
  username?: string
  firstname?: string
  [key: string]: any
}

export interface SignInResult {
  accessToken: string
  refreshToken: string
  user: User
}

interface MobileSignInProps {
  onSuccess: (result: SignInResult) => void
  onCancel: () => void
}

// THIS IS THE ONLY CHANGE YOU NEED
import { tokenStore } from './lib/secureStore'  // ← Correct encrypted storage

const API_BASE = 'https://priscaai.online'
const ENDPOINT = `${API_BASE}/signin/signin-pin`

export default function MobileSignIn({ onSuccess, onCancel }: MobileSignInProps) {
  const [phone, setPhone] = useState<string>('')
  const [pin, setPin] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const savedPhone = localStorage.getItem('rememberedPhone')
    if (savedPhone) setPhone(savedPhone)
  }, [])

  function normalizePhone(input: string): string {
    const d = input.replace(/[^\d+]/g, '')
    if (/^0\d{10}$/.test(d)) return '+234' + d.slice(1)
    if (/^234\d{10}$/.test(d)) return '+' + d
    if (/^\+234\d{10}$/.test(d)) return d
    if (/^[789]\d{9}$/.test(d)) return '+234' + d
    if (/^\+?\d{10,15}$/.test(d)) return d.startsWith('+') ? d : '+' + d
    return d
  }

  function handlePhoneChange(v: string) {
    let digits = v.replace(/\D/g, '').slice(0, 11)
    setPhone(digits)
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    if (loading) return

    setError(null)
    const phonenumber = normalizePhone(phone)
    const passwordpin = String(pin).replace(/[^\d]/g, '').padStart(6, '0')

    if (!/^\+234\d{10}$/.test(phonenumber)) {
      return setError('Enter a valid Nigerian phone number.')
    }
    if (!/^\d{6}$/.test(passwordpin)) {
      return setError('PIN must be exactly 6 digits.')
    }

    setLoading(true)
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phonenumber, passwordpin })
      })

      const data = await res.json().catch(() => ({ success: false, message: 'Unexpected server response.' }))

      if (!res.ok || !data.success) {
        if (data.minutesRemaining) {
          setError(`${data.message} (${data.minutesRemaining} minutes remaining)`)
        } else {
          setError(data.message || `Sign-in failed (HTTP ${res.status}).`)
        }
        return
      }

      // THIS IS THE CRITICAL FIX
      // Now using your real encrypted secure storage
      await tokenStore.setTokens(data.accessToken, data.refreshToken)
      tokenStore.setUser(data.user)

      // Remember phone (safe to keep in localStorage)
      localStorage.setItem('rememberedPhone', phone)

      // Call success
      onSuccess({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user
      })
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err)
      setError(`Network error: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mobile-auth-overlay">
      <div className="mobile-auth-container">
        <div className="mobile-auth-header">
          <div className="mobile-auth-title-row">
            <h2 className="mobile-auth-header-login">Log In</h2>
          </div>

          <button type="button" className="mobile-auth-close-btn" onClick={onCancel}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="mobile-auth-body">
          <form onSubmit={submit} className="mobile-auth-form">
            <label className="mobile-auth-input-wrap">
              <span className="mobile-auth-label">Phone number</span>
              <div className="mobile-auth-phone-input">
                <span className="mobile-auth-phone-prefix">+234</span>
                <input
                  className="mobile-auth-input"
                  placeholder="812 345 6789"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  inputMode="numeric"
                  autoFocus
                  maxLength={11}
                  autoComplete="tel"
                />
              </div>
            </label>

            <label className="mobile-auth-input-wrap">
              <span className="mobile-auth-label">PIN (6 digits)</span>
              <input
                className="mobile-auth-input"
                placeholder="••••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                type="password"
                inputMode="numeric"
                maxLength={6}
                autoComplete="current-password"
              />
            </label>

            {error && <div className="mobile-auth-error">Warning: {error}</div>}

            <div className="mobile-auth-button-row">
              <button className="mobile-auth-button primary" type="submit" disabled={loading}>
                {loading ? 'Signing in…' : 'Login'}
              </button>
            </div>

            <p className="mobile-auth-note">Too many failed attempts can temporarily lock your account.</p>
          </form>
        </div>
      </div>
    </div>
  )
}