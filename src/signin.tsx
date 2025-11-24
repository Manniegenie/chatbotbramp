import React, { useState, useEffect } from 'react'
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

export default function SignIn({
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

  // Load saved phone number on component mount
  useEffect(() => {
    const savedPhone = localStorage.getItem('rememberedPhone')
    if (savedPhone) {
      setPhone(savedPhone)
    }
  }, [])

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

    // Limit to 11 digits (allowing 0 at the beginning)
    digits = digits.slice(0, 11)

    setPhone(digits)
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()

    // Prevent duplicate submissions
    if (loading) return

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

      // Automatically save phone number
      localStorage.setItem('rememberedPhone', phone)

      onSuccess({ accessToken: ok.accessToken, refreshToken: ok.refreshToken, user: ok.user })
    } catch (err: any) {
      setError(`Network error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mobile-auth-overlay">
      {/* Background container with notch color at 50% opacity */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(87, 93, 91, 0.5)',
        zIndex: 1000.5,
        pointerEvents: 'none'
      }} />
      <div className="mobile-auth-container" style={{ position: 'relative', zIndex: 1001 }}>
        <div className="mobile-auth-header">
          <div>
            <h2 className="mobile-auth-title">
              Sign in
            </h2>
            <p className="mobile-auth-description">
              Use your phone number and 6-digit PIN to continue.
            </p>
          </div>
        </div>

        <div className="mobile-auth-body">
          <form onSubmit={submit} className="mobile-auth-form">
            <div className="mobile-auth-fields">
              <div className="mobile-auth-input-wrap">
                <label className="mobile-auth-label">Phone number</label>
                <input
                  placeholder="08123456789"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  inputMode="numeric"
                  autoFocus
                  className="mobile-auth-input no-zoom"
                  maxLength={11}
                  autoComplete="tel"
                />
              </div>

              <div className="mobile-auth-input-wrap">
                <label className="mobile-auth-label">PIN (6 digits)</label>
                <input
                  placeholder="••••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  className="mobile-auth-input no-zoom"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="mobile-auth-error">
                ⚠️ {error}
              </div>
            )}

            <div className="mobile-auth-button-row">
              <button 
                className="mobile-auth-button primary" 
                type="submit" 
                disabled={loading}
              >
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
          </form>

          <p className="mobile-auth-note">
            Too many failed attempts can temporarily lock your account.
          </p>
        </div>
      </div>
    </div>
  )
}
