// src/MobileSignUp.tsx
import React, { useState } from 'react'
import './mobile-auth.css'

export type SignUpResult = {
  success: boolean
  message: string
  user: {
    id: string
    email?: string
    firstname?: string
    lastname?: string
    username?: string
    phonenumber: string
  }
}

type SignUpProps = {
  onSuccess: (result: SignUpResult) => void
  onCancel: () => void
}

export default function MobileSignUp({ onSuccess, onCancel }: SignUpProps) {
  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'
  const ENDPOINT = `${API_BASE}/signup/signup-pin`

  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
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
    const confirmpasswordpin = String(confirmPin).replace(/[^\d]/g, '').padStart(6, '0')

    if (phone.length !== 10) {
      return setError('Enter a valid 10-digit phone number.')
    }
    if (!/^\d{6}$/.test(passwordpin)) {
      return setError('PIN must be exactly 6 digits.')
    }
    if (passwordpin !== confirmpasswordpin) {
      return setError('PINs do not match.')
    }

    setLoading(true)
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phonenumber, passwordpin, confirmpasswordpin }),
      })

      const data = await res.json().catch(() => ({
        success: false,
        message: 'Unexpected server response.',
      }))

      if (!res.ok || !data.success) {
        setError(data.message || `Sign-up failed (HTTP ${res.status}).`)
        return
      }

      onSuccess(data)
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
            <div className="mobile-auth-icon">📝</div>
            <h2 className="mobile-auth-title">Create Account</h2>
          </div>
          <button type="button" className="mobile-auth-close" onClick={onCancel}>✕</button>
        </div>

        <div className="mobile-auth-body">
          <p className="mobile-auth-description">
            Enter your phone number and create a 6-digit PIN to get started.
          </p>

          <form onSubmit={submit} className="mobile-auth-form">
            <label className="mobile-auth-input-wrap">
              <span className="mobile-auth-label">Phone number</span>
              <div className="mobile-auth-phone-input">
                <span className="mobile-auth-phone-prefix">+234</span>
                <input
                  className="mobile-auth-input"
                  placeholder="8141751569"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  inputMode="numeric"
                  autoFocus
                  maxLength={10}
                />
              </div>
            </label>

            <label className="mobile-auth-input-wrap">
              <span className="mobile-auth-label">Create PIN (6 digits)</span>
              <input
                className="mobile-auth-input"
                placeholder="******"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                type="password"
                inputMode="numeric"
                maxLength={6}
              />
            </label>

            <label className="mobile-auth-input-wrap">
              <span className="mobile-auth-label">Confirm PIN</span>
              <input
                className="mobile-auth-input"
                placeholder="******"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
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
                {loading ? 'Creating account…' : 'Create Account'}
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
              You'll need to verify your phone number with an OTP after signup.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
