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
            <h2 id="signin-title" style={{ marginTop: 0, marginBottom: 6, fontSize: '1.2rem' }}>
              Sign in
            </h2>
            <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
              Use your phone number and 6-digit PIN to continue.
            </p>

            <form onSubmit={submit}>
              <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Phone number</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '12px',
                    color: 'var(--txt)',
                    fontSize: '16px',
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
                    paddingLeft: '60px',
                  }}
                  className="no-zoom"
                  maxLength={10}
                />
              </div>

              <div style={{ height: 8 }} />

              <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>PIN (6 digits)</label>
              <input
                placeholder="******"
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

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
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