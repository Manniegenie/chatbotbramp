import React, { useState } from 'react'

export type SignUpResult = {
  success: boolean
  message?: string
  user?: {
    firstname?: string
    lastname?: string
    email?: string
    phonenumber?: string
    bvn?: string
    dob?: string
  }
}

type ServerSuccess = {
  success: true
  message: string
  emailSent?: boolean
  otpSent?: boolean
  userId?: string
}

type ServerError =
  | { success: false; message: string; errors?: any[] }
  | { success: false; message: string }

export default function SignUp({
  onSuccess,
  onCancel,
}: {
  onSuccess: (result: SignUpResult) => void
  onCancel: () => void
}) {
  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'
  const ENDPOINT = `${API_BASE}/signup/add-user`

  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [dob, setDob] = useState('')
  const [bvn, setBvn] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function normalizePhone(input: string) {
    const d = input.replace(/[^\d+]/g, '')
    if (/^0\d{10}$/.test(d)) return '+234' + d.slice(1)
    if (/^234\d{10}$/.test(d)) return '+' + d
    if (/^\+?\d{10,15}$/.test(d)) return d.startsWith('+') ? d : '+' + d
    return d
  }

  function isAdult(iso: string) {
    if (!iso) return false
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return false
    const now = new Date()
    const hadBirthdayThisYear = now >= new Date(now.getFullYear(), d.getMonth(), d.getDate())
    const age = now.getFullYear() - d.getFullYear() - (hadBirthdayThisYear ? 0 : 1)
    return age >= 18
  }

  function validate(): string | null {
    if (firstname.trim().length < 2) return 'Enter a valid first name.'
    if (lastname.trim().length < 2) return 'Enter a valid surname.'
    const phonenumber = normalizePhone(phone)
    if (!/^\+?\d{10,15}$/.test(phonenumber)) return 'Enter a valid phone number (e.g. +2348100000000).'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase())) return 'Enter a valid email address.'
    if (!isAdult(dob)) return 'You must be at least 18 years old.'
    if (!/^\d{11}$/.test(bvn)) return 'BVN must be exactly 11 digits.'
    return null
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    setError(null)

    const invalid = validate()
    if (invalid) {
      setError(invalid)
      return
    }

    const phonenumber = normalizePhone(phone)

    setLoading(true)
    try {
      const payload = {
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        phonenumber,
        email: email.trim().toLowerCase(),
        dob,                // YYYY-MM-DD
        dateOfBirth: dob,   // alias for backend compatibility
        bvn: bvn.trim(),
      }

      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data: ServerSuccess | ServerError = await res.json().catch(
        () =>
          ({
            success: false,
            message: 'Unexpected server response.',
          }) as ServerError
      )

      if (!res.ok || !('success' in data) || data.success === false) {
        setError((data as any).message || `Signup failed (HTTP ${res.status}).`)
        return
      }

      const ok = data as ServerSuccess
      onSuccess({
        success: true,
        message: ok.message || 'Account created. Please verify OTP to complete your signup.',
        user: payload,
      })
    } catch (err: any) {
      setError(`Network error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chat" role="dialog" aria-modal="true" aria-labelledby="signup-title">
      <div className="messages" style={{ paddingTop: 0 }}>
        <div className="bubble" style={{ maxWidth: 560 }}>
          <div className="role">Security</div>
          <div className="text">
            <h2 id="signup-title" style={{ marginTop: 0, marginBottom: 8 }}>Sign up</h2>
            <p style={{ marginTop: 0, color: 'var(--muted)' }}>
              Create your account to continue. We’ll send an OTP to verify.
            </p>

            <form onSubmit={submit}>
              <label style={{ fontSize: 12, color: 'var(--muted)' }}>First name</label>
              <input
                placeholder="Chibuike"
                value={firstname}
                onChange={(e) => setFirstname(e.target.value)}
                autoFocus
                style={inputStyle}
              />

              <div style={{ height: 10 }} />

              <label style={{ fontSize: 12, color: 'var(--muted)' }}>Surname</label>
              <input
                placeholder="Nwogbo"
                value={lastname}
                onChange={(e) => setLastname(e.target.value)}
                style={inputStyle}
              />

              <div style={{ height: 10 }} />

              <label style={{ fontSize: 12, color: 'var(--muted)' }}>Phone number</label>
              <input
                placeholder="+2348100000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                style={inputStyle}
              />

              <div style={{ height: 10 }} />

              <label style={{ fontSize: 12, color: 'var(--muted)' }}>Email address</label>
              <input
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                style={inputStyle}
              />

              <div style={{ height: 10 }} />

              <label style={{ fontSize: 12, color: 'var(--muted)' }}>Date of birth</label>
              <input
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                style={inputStyle}
              />

              <div style={{ height: 10 }} />

              <label style={{ fontSize: 12, color: 'var(--muted)' }}>BVN (11 digits)</label>
              <input
                placeholder="12345678901"
                value={bvn}
                onChange={(e) => setBvn(e.target.value.replace(/[^\d]/g, '').slice(0, 11))}
                inputMode="numeric"
                maxLength={11}
                style={inputStyle}
              />

              {error && (
                <div style={{ color: '#fda4af', marginTop: 10, fontSize: 13 }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button className="btn" type="submit" disabled={loading}>
                  {loading ? 'Creating…' : 'Create account'}
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
              We’ll verify your details with OTP. Keep your phone handy.
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
