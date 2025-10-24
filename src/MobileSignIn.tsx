// src/MobileSignIn.tsx
import React, { useState } from 'react'
import { tokenStore } from './lib/secureStore'
import { normalizePhone } from './utils/phoneNormalization.test'
import './mobile-auth.css'

type ServerSuccess = {
  success: true
  message: string
  accessToken: string
  refreshToken: string
  emailSent: boolean
  user: {
    id: string
    email?: string
    firstname?: string
    lastname?: string
    username?: string
    phonenumber: string
    kycLevel?: number
    kycStatus?: string
    walletGenerationStatus?: string
    avatarUrl?: string
  }
}

type ServerError =
  | { success: false; message: string; errors?: any[]; lockedUntil?: string; minutesRemaining?: number }
  | { success: false; message: string }

export type SignInResult = {
  accessToken: string
  refreshToken: string
  user: ServerSuccess['user']
}

export default function MobileSignIn({
  onSuccess,
  onCancel,
}: {
  onSuccess: (result: SignInResult) => void
  onCancel: () => void
}) {
  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'
  const ENDPOINT = `${API_BASE}/signin/signin-pin`

  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Phone number normalization function
  function normalizePhone(input: string): string {
    const d = input.replace(/[^\d+]/g, '')
    
    // Handle Nigerian phone numbers specifically
    if (/^0\d{10}$/.test(d)) return '+234' + d.slice(1) // 08123456789 -> +2348123456789
    if (/^234\d{10}$/.test(d)) return '+' + d // 2348123456789 -> +2348123456789
    if (/^\+234\d{10}$/.test(d)) return d // +2348123456789 -> +2348123456789
    
    // Handle 10-digit numbers that could be Nigerian (starting with 7, 8, or 9)
    if (/^[789]\d{9}$/.test(d)) return '+234' + d // 8123456789 -> +2348123456789
    
    // Handle other international formats
    if (/^\+?\d{10,15}$/.test(d)) return d.startsWith('+') ? d : '+' + d
    
    return d
  }

  function handlePhoneChange(value: string) {
    // Remove all non-digits
    let digits = value.replace(/\D/g, '')
    
    // If starts with 0, remove it (e.g., 08141751569 becomes 8141751569)
    if (digits.startsWith('0')) {
      digits = digits.slice(1)
    }
    
    // Limit to 10 digits
    digits = digits.slice(0, 10)
    
    setPhone(digits)
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    setError(null)

    // Normalize phone number
    const phonenumber = normalizePhone(phone)
    const passwordpin = String(pin).replace(/[^\d]/g, '').padStart(6, '0')

    // Validate normalized phone number
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
        body: JSON.stringify({ phonenumber, passwordpin }),
      })

      const data: ServerSuccess | ServerError = await res.json().catch(
        () =>
          ({
            success: false,
            message: 'Unexpected server response.',
          }) as ServerError
      )

      if (!res.ok || !('success' in data) || data.success === false) {
        if ('minutesRemaining' in (data as any) && (data as any).minutesRemaining) {
          setError(`${(data as any).message} (${(data as any).minutesRemaining} minutes remaining)`)
        } else {
          setError((data as any).message || `Sign-in failed (HTTP ${res.status}).`)
        }
        return
      }

      const ok = data as ServerSuccess
      tokenStore.setTokens(ok.accessToken, ok.refreshToken)
      tokenStore.setUser(ok.user)

      onSuccess({ accessToken: ok.accessToken, refreshToken: ok.refreshToken, user: ok.user })
    } catch (err: any) {
      setError(`Network error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mobile-auth-overlay" onClick={onCancel}>
      <div className="mobile-auth-container" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-auth-header">
          <div className="mobile-auth-title-row">
            <div className="mobile-auth-icon">🔐</div>
            <h2 className="mobile-auth-title">Sign in</h2>
          </div>
          <button type="button" className="mobile-auth-close" onClick={onCancel}>✕</button>
        </div>

        <div className="mobile-auth-body">
          <p className="mobile-auth-description">
            Use your phone number and 6-digit PIN to continue.
          </p>

          <form onSubmit={submit} className="mobile-auth-form">
            <label className="mobile-auth-input-wrap">
              <span className="mobile-auth-label">Phone number</span>
              <div className="mobile-auth-phone-input">
                <span className="mobile-auth-phone-prefix">+234</span>
                <input
                  className="mobile-auth-input"
                  placeholder="08123456789"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  inputMode="numeric"
                  autoFocus
                  maxLength={10}
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
              />
            </label>

            {error && (
              <div className="mobile-auth-error">
                ⚠️ {error}
              </div>
            )}

            <div className="mobile-auth-button-row">
              <button className="mobile-auth-button primary" type="submit" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
              <button
                type="button"
                className="mobile-auth-button outline"
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </button>
            </div>

            <p className="mobile-auth-note">
              Too many failed attempts can temporarily lock your account.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
