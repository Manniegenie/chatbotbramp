import React, { useState } from 'react'
import { tokenStore } from './lib/secureStore'

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

    // Build final phone number with +234 prefix
    const phonenumber = '+234' + phone
    const passwordpin = String(pin).replace(/[^\d]/g, '').padStart(6, '0')

    if (phone.length !== 10) {
      return setError('Enter a valid 10-digit phone number.')
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
    <div
      className="chat"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signin-title"
      style={{
        width: '100%',
        maxWidth: '100vw',
        padding: '8px 10px 0',
      }}
    >
      <div className="messages" style={{ paddingTop: 0 }}>
        <div className="bubble" style={{ maxWidth: '95%' }}>
          <div className="role">Security</div>
          <div className="text">
            <h2 id="signin-title" style={{ marginTop: 0, marginBottom: 8, fontSize: 18, fontWeight: 600 }}>
              Sign in
            </h2>
            <p style={{ marginTop: 0, marginBottom: 16, color: 'var(--muted)', fontSize: 15, lineHeight: 1.5 }}>
              Use your phone number and 6-digit PIN to continue.
            </p>

            <form onSubmit={submit}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>
                Phone number
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 14 }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 14,
                    color: 'var(--txt)',
                    fontSize: 16,
                    fontWeight: 500,
                    pointerEvents: 'none',
                    zIndex: 1,
                  }}
                >
                  +234
                </span>
                <input
                  placeholder="8141751569"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  inputMode="numeric"
                  autoFocus
                  style={{
                    ...inputStyle,
                    paddingLeft: 64,
                  }}
                  className="no-zoom"
                  maxLength={10}
                />
              </div>

              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>
                PIN (6 digits)
              </label>
              <input
                placeholder="Enter your 6-digit PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                type="password"
                inputMode="numeric"
                maxLength={6}
                style={{...inputStyle, marginBottom: 12}}
                className="no-zoom"
              />

              {error && (
                <div style={{ 
                  color: '#fda4af', 
                  marginBottom: 14, 
                  fontSize: 14, 
                  padding: 12,
                  background: 'rgba(220, 50, 50, 0.1)',
                  border: '1px solid rgba(220, 50, 50, 0.25)',
                  borderRadius: 8,
                  lineHeight: 1.4
                }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                <button className="btn" type="submit" disabled={loading} style={{ flex: 1, minWidth: 120 }}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={onCancel}
                  disabled={loading}
                  style={{ flex: 1, minWidth: 120 }}
                >
                  Cancel
                </button>
              </div>
            </form>

            <p style={{ marginTop: 14, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
              Too many failed attempts can temporarily lock your account.
            </p>
          </div>
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
  padding: '12px 14px',
  borderRadius: 10,
  outline: 'none',
  fontSize: 16,
  WebkitTextSizeAdjust: '100%',
  textSizeAdjust: '100%',
  minHeight: 44,
  lineHeight: 1.4,
  touchAction: 'manipulation',
  transition: 'border-color 0.2s ease',
}