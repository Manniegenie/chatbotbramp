import React, { useState, useEffect } from 'react'
import { tokenStore } from './lib/secureStore'
import { normalizePhone } from './utils/phoneNormalization.test'

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
  const [rememberMe, setRememberMe] = useState(false)

  // Load saved phone number on component mount
  useEffect(() => {
    const savedPhone = localStorage.getItem('rememberedPhone')
    if (savedPhone) {
      setPhone(savedPhone)
      setRememberMe(true)
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

      // Save phone number if remember me is checked
      if (rememberMe) {
        localStorage.setItem('rememberedPhone', phone)
      } else {
        localStorage.removeItem('rememberedPhone')
      }

      onSuccess({ accessToken: ok.accessToken, refreshToken: ok.refreshToken, user: ok.user })
    } catch (err: any) {
      setError(`Network error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      width: '100vw', 
      height: '100vh', 
      background: 'linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(/src/assets/wallpaper1.jpg) center/cover no-repeat', 
      zIndex: 1000,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '20px 16px',
      overflow: 'hidden',
      touchAction: 'none'
    }}>
      <div style={{ 
        maxWidth: '480px', 
        width: '100%',
        maxHeight: '80vh',
        marginTop: '6vh',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '28px',
        boxShadow: 'var(--shadow)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ marginBottom: '16px', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 600, color: 'var(--txt)' }}>
            Sign in
          </h2>
          <p style={{ marginTop: '6px', color: 'var(--muted)', fontSize: '0.85rem' }}>
            Use your phone number and 6-digit PIN to continue.
          </p>
        </div>

        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <form onSubmit={submit}>
              <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Phone number</label>
              <input
                placeholder="08123456789"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                inputMode="numeric"
                autoFocus
                style={inputStyle}
                className="no-zoom"
                maxLength={11}
              />

              <div style={{ height: 8 }} />

              <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>PIN (6 digits)</label>
              <input
                placeholder="••••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                type="password"
                inputMode="numeric"
                maxLength={6}
                style={inputStyle}
                className="no-zoom"
              />

              {error && (
                <div style={{ color: '#fda4af', marginTop: 8, fontSize: '0.8rem' }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ 
                    margin: 0, 
                    width: '16px', 
                    height: '16px', 
                    accentColor: 'var(--accent)',
                    cursor: 'pointer'
                  }}
                />
                <label htmlFor="rememberMe" style={{ fontSize: '0.8rem', color: 'var(--muted)', cursor: 'pointer', margin: 0, userSelect: 'none' }}>
                  Remember me
                </label>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn" type="submit" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={onCancel}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
          </form>

          <p style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--muted)' }}>
            Too many failed attempts can temporarily lock your account.
          </p>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--card)',
  border: '1px solid var(--border)',
  color: 'var(--txt)',
  padding: '10px 12px',
  borderRadius: 8,
  outline: 'none',
  fontSize: '16px !important',
  WebkitTextSizeAdjust: '100%',
  minHeight: '40px',
  lineHeight: '1.35',
}