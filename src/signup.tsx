import React, { useState } from 'react'

export type SignUpResult = {
  success: boolean
  message?: string
  userId?: string
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
  const SIGNUP_ENDPOINT = `${API_BASE}/chatsignup/add-user`
  const VERIFY_OTP_ENDPOINT = `${API_BASE}/verify-otp/verify-otp`
  const RESEND_OTP_ENDPOINT = `${API_BASE}/signup/resend-otp`

  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [dob, setDob] = useState('')
  const [bvn, setBvn] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

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
        dob,
        dateOfBirth: dob,
        bvn: bvn.trim(),
      }

      const res = await fetch(SIGNUP_ENDPOINT, {
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
      setUserId(ok.userId || null)
      setShowOtpModal(true)
    } catch (err: any) {
      setError(`Network error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp(e?: React.FormEvent) {
    e?.preventDefault()
    setOtpError(null)

    if (!/^\d{6}$/.test(otp)) {
      setOtpError('OTP must be a 6-digit number.')
      return
    }

    if (!userId) {
      setOtpError('User ID not found. Please try signing up again.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(VERIFY_OTP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, otp }),
      })

      const data: ServerSuccess | ServerError = await res.json().catch(
        () =>
          ({
            success: false,
            message: 'Unexpected server response.',
          }) as ServerError
      )

      if (!res.ok || !('success' in data) || data.success === false) {
        setOtpError((data as any).message || `OTP verification failed (HTTP ${res.status}).`)
        return
      }

      const ok = data as ServerSuccess
      onSuccess({
        success: true,
        message: ok.message || 'OTP verified successfully.',
        userId: userId,
        user: {
          firstname: firstname.trim(),
          lastname: lastname.trim(),
          phonenumber: normalizePhone(phone),
          email: email.trim().toLowerCase(),
          dob,
          bvn: bvn.trim(),
        },
      })
      setShowOtpModal(false)
    } catch (err: any) {
      setOtpError(`Network error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function resendOtp() {
    if (!userId) {
      setOtpError('User ID not found. Please try signing up again.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(RESEND_OTP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      const data: ServerSuccess | ServerError = await res.json().catch(
        () =>
          ({
            success: false,
            message: 'Unexpected server response.',
          }) as ServerError
      )

      if (!res.ok || !('success' in data) || data.success === false) {
        setOtpError((data as any).message || `Failed to resend OTP (HTTP ${res.status}).`)
        return
      }

      setOtpError(null)
      alert('OTP resent successfully. Check your phone or email.')
    } catch (err: any) {
      setOtpError(`Network error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="chat"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signup-title"
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
            <h2 id="signup-title" style={{ marginTop: 0, marginBottom: 6, fontSize: '1.2rem' }}>
              Sign up
            </h2>
            <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
              Create your account to continue. We’ll send an OTP to verify.
            </p>

            <form onSubmit={submit}>
              <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>First name</label>
              <input
                placeholder="Chibuike"
                value={firstname}
                onChange={(e) => setFirstname(e.target.value)}
                autoFocus
                style={inputStyle}
                className="no-zoom"
              />

              <div style={{ height: 8 }} />

              <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Surname</label>
              <input
                placeholder="Nwogbo"
                value={lastname}
                onChange={(e) => setLastname(e.target.value)}
                style={inputStyle}
                className="no-zoom"
              />

              <div style={{ height: 8 }} />

              <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Phone number</label>
              <input
                placeholder="+2348100000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                style={inputStyle}
                className="no-zoom"
              />

              <div style={{ height: 8 }} />

              <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Email address</label>
              <input
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                style={inputStyle}
                className="no-zoom"
              />

              <div style={{ height: 8 }} />

              <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Date of birth</label>
              <input
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                style={inputStyle}
                className="no-zoom"
              />

              <div style={{ height: 8 }} />

              <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>BVN (11 digits)</label>
              <input
                placeholder="12345678901"
                value={bvn}
                onChange={(e) => setBvn(e.target.value.replace(/[^\d]/g, '').slice(0, 11))}
                inputMode="numeric"
                maxLength={11}
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
                  {loading ? 'Creating…' : 'Create account'}
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
              We’ll verify your details with OTP. Keep your phone handy.
            </p>
          </div>
        </div>
      </div>

      {showOtpModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '0 10px',
            touchAction: 'manipulation',
          }}
        >
          <div className="bubble" style={{ maxWidth: '95%', padding: '12px 14px' }}>
            <div className="text">
              <h2 style={{ marginTop: 0, marginBottom: 6, fontSize: '1.2rem' }}>
                Verify OTP
              </h2>
              <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
                Enter the 6-digit OTP sent to your phone or email.
              </p>

              <form onSubmit={verifyOtp}>
                <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>OTP</label>
                <input
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  style={inputStyle}
                  className="no-zoom"
                />

                {otpError && (
                  <div style={{ color: '#fda4af', marginTop: 8, fontSize: '0.8rem' }}>
                    ⚠️ {otpError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn" type="submit" disabled={loading}>
                    {loading ? 'Verifying…' : 'Verify OTP'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={resendOtp}
                    disabled={loading}
                  >
                    Resend OTP
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setShowOtpModal(false)}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
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