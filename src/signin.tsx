// signin.tsx
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

  function normalizePhone(input: string) {
    const d = input.replace(/[^\d+]/g, '')
    if (/^0\d{10}$/.test(d)) return '+234' + d.slice(1)
    if (/^234\d{10}$/.test(d)) return '+' + d
    if (/^\+?\d{10,15}$/.test(d)) return d.startsWith('+') ? d : '+' + d
    return d
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    setError(null)

    const phonenumber = normalizePhone(phone)
    const passwordpin = String(pin).replace(/[^\d]/g, '').padStart(6, '0')

    if (!/^\+?\d{10,15}$/.test(phonenumber)) return setError('Enter a valid phone number (e.g. +2348100000000).')
    if (!/^\d{6}$/.test(passwordpin)) return setError('PIN must be exactly 6 digits.')

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
    <div className="chat" role="dialog" aria-modal="true" aria-labelledby="signin-title">
      <div className="messages" style={{ paddingTop: 0 }}>
        <div className="bubble" style={{ maxWidth: 560 }}>
          <div className="role">Security</div>
          <div className="text">
            <h2 id="signin-title" style={{ marginTop: 0, marginBottom: 8 }}>Sign in</h2>
            <p style={{ marginTop: 0, color: 'var(--muted)' }}>
              Use your phone number and 6-digit PIN to continue.
            </p>

            <form onSubmit={submit}>
              <label style={{ fontSize: 12, color: 'var(--muted)' }}>Phone number</label>
              <input
                placeholder="+2348100000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoFocus
                style={inputStyle}
              />

              <div style={{ height: 10 }} />

              <label style={{ fontSize: 12, color: 'var(--muted)' }}>PIN (6 digits)</label>
              <input
                placeholder="******"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                type="password"
                inputMode="numeric"
                maxLength={6}
                style={inputStyle}
              />

              {error && (
                <div style={{ color: '#fda4af', marginTop: 10, fontSize: 13 }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button className="btn" type="submit" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)' }}
                  onClick={onCancel}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </form>

            <p style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>
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
}
