// src/SignUp.tsx
import React, { useEffect, useState } from 'react'

export type SignUpResult = {
  success: boolean
  message?: string
  userId?: string
  accessToken?: string
  refreshToken?: string
  user?: {
    firstname?: string
    lastname?: string
    email?: string
    phonenumber?: string
    bvn?: string
    username?: string
  }
}

type VerifySuccess = {
  message: string
  pendingUserId: string
  email: string
  firstname: string
  lastname: string
  phonenumber: string
}

type ServerSuccess = {
  success: true
  message: string
  otpSent?: boolean
  userId?: string              // pending user id
  user?: {
    email: string
    phonenumber: string
    firstname: string
    lastname: string
    bvn?: string
  }
}

type PinSuccess = {
  message: string
  user: {
    id: string
    email: string
    phonenumber: string
    firstname: string
    lastname: string
    username: string
    kycLevel: number
    kycStatus: string
  }
  accessToken: string
  refreshToken: string
}

type ServerError =
  | { success: false; message: string; errors?: any[] }
  | { success: false; message: string }

type StepId = 'firstname' | 'lastname' | 'phone' | 'email' | 'bvn'

// Reusable, consistent modal component (no backdrop-dismiss!)
function Modal({
  open,
  titleId,
  children,
}: {
  open: boolean
  titleId?: string
  children: React.ReactNode
}) {
  // Lock background scroll while open (mobile-friendly)
  useEffect(() => {
    if (!open) return
    const { overflow, position, width } = document.body.style
    const scrollBarComp = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.width = `calc(100% - ${scrollBarComp}px)`
    return () => {
      document.body.style.overflow = overflow
      document.body.style.position = position
      document.body.style.width = width
    }
  }, [open])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      // Backdrop: keep visible, but DO NOT close on tap.
      // We also stop pointer/touch events from bubbling to any parent.
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => {
        // prevent rubber-band scrolling on iOS within the backdrop
        e.preventDefault()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '0 10px',
        touchAction: 'none', // avoid accidental double-tap zoom & gestures
      }}
    >
      <div
        // Inner container styled like your “details entry” bubble
        className="bubble"
        style={{
          maxWidth: '95%',
          width: '100%',
          padding: '12px 14px',
          // Prevent clicks leaking out
          pointerEvents: 'auto',
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="text">{children}</div>
      </div>
    </div>
  )
}

export default function SignUp({
  onSuccess,
  onCancel,
}: {
  onSuccess: (result: SignUpResult) => void
  onCancel: () => void
}) {
  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'
  const SIGNUP_ENDPOINT = `${API_BASE}/chatsignup/add-user`
  const VERIFY_OTP_ENDPOINT = `${API_BASE}/verify-otp/verify-otp`         // expects { phonenumber, code }
  const RESEND_OTP_ENDPOINT = `${API_BASE}/signup/resend-otp`             // expects { phonenumber }
  const PASSWORD_PIN_ENDPOINT = `${API_BASE}/passwordpin/password-pin`    // expects { newPin, renewPin, pendingUserId }  

  // Redirect after full signup completion (PIN saved)
  const KYC_REDIRECT_URL =
    'https://links.sandbox.usesmileid.com/7932/7675c604-fd18-424a-a61e-a0052eb5bcbf'

  const [stepIndex, setStepIndex] = useState<number>(0)
  const steps: StepId[] = ['firstname', 'lastname', 'phone', 'email', 'bvn']

  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [bvn, setBvn] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showOtpModal, setShowOtpModal] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)

  const [showPinModal, setShowPinModal] = useState(false)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)

  const [pendingUserId, setPendingUserId] = useState<string | null>(null) // from signup/verify

  function normalizePhone(input: string) {
    const d = input.replace(/[^\d+]/g, '')
    if (/^0\d{10}$/.test(d)) return '+234' + d.slice(1)
    if (/^234\d{10}$/.test(d)) return '+' + d
    if (/^\+?\d{10,15}$/.test(d)) return d.startsWith('+') ? d : '+' + d
    return d
  }

  function validateField(step: StepId): string | null {
    switch (step) {
      case 'firstname':
        if (firstname.trim().length < 2) return 'Enter a valid first name.'
        return null
      case 'lastname':
        if (lastname.trim().length < 2) return 'Enter a valid surname.'
        return null
      case 'phone': {
        const phonenumber = normalizePhone(phone)
        if (!/^\+?\d{10,15}$/.test(phonenumber))
          return 'Enter a valid phone number (e.g. +2348100000000).'
        return null
      }
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase()))
          return 'Enter a valid email address.'
        return null
      case 'bvn':
        if (!/^\d{11}$/.test(bvn)) return 'BVN must be exactly 11 digits.'
        return null
    }
  }

  function validateAll(): string | null {
    for (const s of steps) {
      const v = validateField(s)
      if (v) return v
    }
    return null
  }

  function goNext() {
    setError(null)
    const currentStep = steps[stepIndex]
    const invalid = validateField(currentStep)
    if (invalid) {
      setError(invalid)
      return
    }
    setStepIndex((i) => Math.min(i + 1, steps.length - 1))
  }

  function goBack() {
    setError(null)
    setStepIndex((i) => Math.max(i - 1, 0))
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    setError(null)

    const invalid = validateAll()
    if (invalid) {
      setError(invalid)
      const firstBadIndex = steps.findIndex((s) => validateField(s))
      if (firstBadIndex >= 0) setStepIndex(firstBadIndex)
      return
    }

    const phonenumber = normalizePhone(phone)
    setLoading(true)
    try {
      const payload = {
        email: email.trim().toLowerCase(),
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        phonenumber,
        bvn: bvn.trim(),
      }

      const res = await fetch(SIGNUP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data: ServerSuccess | ServerError = await res.json().catch(
        () => ({ success: false, message: 'Unexpected server response.' }) as ServerError
      )

      if (!res.ok || !('success' in data) || data.success === false) {
        const msg =
          (data as any)?.message ||
          (Array.isArray((data as any)?.errors) ? (data as any).errors[0]?.msg : null) ||
          `Signup failed (HTTP ${res.status}).`
        setError(msg)
        return
      }

      const ok = data as ServerSuccess
      if (ok.userId) setPendingUserId(ok.userId)
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

    const phonenumber = normalizePhone(phone)
    if (!/^\+?\d{10,15}$/.test(phonenumber)) {
      setOtpError('Invalid phone number format.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(VERIFY_OTP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phonenumber, code: otp }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        setOtpError(errJson?.message || `OTP verification failed (HTTP ${res.status}).`)
        return
      }

      const ok: VerifySuccess = await res.json()
      setPendingUserId(ok.pendingUserId)
      setShowOtpModal(false)
      setShowPinModal(true)
    } catch (err: any) {
      setOtpError(`Network error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function resendOtp() {
    const phonenumber = normalizePhone(phone)
    if (!/^\+?\d{10,15}$/.test(phonenumber)) {
      setOtpError('Invalid phone number format.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(RESEND_OTP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phonenumber }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setOtpError(data?.message || `Failed to resend OTP (HTTP ${res.status}).`)
        return
      }

      setOtpError(null)
      alert('OTP resent successfully. Check your phone.')
    } catch (err: any) {
      setOtpError(`Network error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ====== PIN ======
  function validatePinFields(): string | null {
    if (!/^\d{6}$/.test(pin)) return 'PIN must be exactly 6 digits.'
    if (pin !== pin2) return 'PINs do not match.'
    if (!pendingUserId) return 'Missing pending user ID. Please repeat verification.'
    return null
  }

  async function setPasswordPin(e?: React.FormEvent) {
    e?.preventDefault()
    setPinError(null)

    const invalid = validatePinFields()
    if (invalid) {
      setPinError(invalid)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(PASSWORD_PIN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPin: pin,
          renewPin: pin2,
          pendingUserId,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        setPinError(errJson?.message || `Failed to set PIN (HTTP ${res.status}).`)
        return
      }

      const ok: PinSuccess = await res.json()

      onSuccess({
        success: true,
        message: ok.message,
        userId: ok.user?.id,
        accessToken: ok.accessToken,
        refreshToken: ok.refreshToken,
        user: {
          firstname: ok.user?.firstname,
          lastname: ok.user?.lastname,
          email: ok.user?.email,
          phonenumber: ok.user?.phonenumber,
          bvn: bvn.trim(),
          username: ok.user?.username,
        },
      })

      setShowPinModal(false)
      window.location.replace(KYC_REDIRECT_URL)
    } catch (err: any) {
      setPinError(`Network error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // --- UI helpers ---
  const totalSteps = steps.length
  const currentStepId = steps[stepIndex]

  function renderStep() {
    switch (currentStepId) {
      case 'firstname':
        return (
          <>
            <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>First name</label>
            <input
              key="fn"
              placeholder="Chibuike"
              value={firstname}
              onChange={(e) => setFirstname(e.target.value)}
              autoFocus
              style={inputStyle}
              className="no-zoom"
            />
          </>
        )
      case 'lastname':
        return (
          <>
            <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Surname</label>
            <input
              key="ln"
              placeholder="Nwogbo"
              value={lastname}
              onChange={(e) => setLastname(e.target.value)}
              autoFocus
              style={inputStyle}
              className="no-zoom"
            />
          </>
        )
      case 'phone':
        return (
          <>
            <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Phone number</label>
            <input
              key="ph"
              placeholder="+2348100000000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoFocus
              style={inputStyle}
              className="no-zoom"
            />
          </>
        )
      case 'email':
        return (
          <>
            <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Email address</label>
            <input
              key="em"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoFocus
              style={inputStyle}
              className="no-zoom"
            />
          </>
        )
      case 'bvn':
        return (
          <>
            <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>BVN (11 digits)</label>
            <input
              key="bvn"
              placeholder="12345678901"
              value={bvn}
              onChange={(e) => setBvn(e.target.value.replace(/[^\d]/g, '').slice(0, 11))}
              inputMode="numeric"
              maxLength={11}
              autoFocus
              style={inputStyle}
              className="no-zoom"
            />
          </>
        )
    }
  }

  function ProgressDots() {
    return (
      <div style={{ display: 'flex', gap: 6, margin: '6px 0 10px' }} aria-hidden>
        {steps.map((_, i) => (
          <span
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: i === stepIndex ? 'var(--accent)' : '#242433',
              display: 'inline-block',
              opacity: i === stepIndex ? 1 : 0.7,
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className="chat"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signup-title"
      style={{ width: '100%', maxWidth: '100vw', padding: '8px 10px 0' }}
    >
      <div className="messages" style={{ paddingTop: 0 }}>
        <div className="bubble" style={{ maxWidth: '95%' }}>
          <div className="role">Security</div>
          <div className="text">
            <h2 id="signup-title" style={{ marginTop: 0, marginBottom: 6, fontSize: '1.2rem' }}>
              Create your account
            </h2>
            <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
              We’ll collect a few details. One step at a time.
            </p>

            <ProgressDots />

            <form onSubmit={(e) => (currentStepId === 'bvn' ? submit(e) : (e.preventDefault(), goNext()))}>
              {renderStep()}

              {error && (
                <div style={{ color: '#fda4af', marginTop: 8, fontSize: '0.8rem' }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {stepIndex > 0 ? (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={goBack}
                    disabled={loading}
                  >
                    Back
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={onCancel}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                )}

                {stepIndex < totalSteps - 1 ? (
                  <button type="submit" className="btn" disabled={loading}>
                    {loading ? 'Please wait…' : 'Next'}
                  </button>
                ) : (
                  <button type="submit" className="btn" disabled={loading}>
                    {loading ? 'Creating…' : 'Create account'}
                  </button>
                )}
              </div>
            </form>

            <p style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--muted)' }}>
              We’ll send an OTP to verify your phone.
            </p>
          </div>
        </div>
      </div>

      {/* OTP Modal — consistent look, no backdrop-dismiss */}
      <Modal open={showOtpModal} titleId="otp-title">
        <h2 id="otp-title" style={{ marginTop: 0, marginBottom: 6, fontSize: '1.2rem' }}>
          Verify OTP
        </h2>
        <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
          Enter the 6-digit OTP sent to your phone.
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
      </Modal>

      {/* Set PIN Modal — consistent look, no backdrop-dismiss */}
      <Modal open={showPinModal} titleId="pin-title">
        <h2 id="pin-title" style={{ marginTop: 0, marginBottom: 6, fontSize: '1.2rem' }}>
          Set your PIN
        </h2>
        <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
          Create a 6-digit PIN for sign-in and transactions.
        </p>

        <form onSubmit={setPasswordPin}>
          <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>PIN (6 digits)</label>
          <input
            placeholder="••••••"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
            inputMode="numeric"
            maxLength={6}
            type="password"
            autoFocus
            style={inputStyle}
            className="no-zoom"
          />

          <div style={{ height: 8 }} />

          <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Confirm PIN</label>
          <input
            placeholder="••••••"
            value={pin2}
            onChange={(e) => setPin2(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
            inputMode="numeric"
            maxLength={6}
            type="password"
            style={inputStyle}
            className="no-zoom"
          />

          {pinError && (
            <div style={{ color: '#fda4af', marginTop: 8, fontSize: '0.8rem' }}>
              ⚠️ {pinError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setShowPinModal(false)}
              disabled={loading}
            >
              Cancel
            </button>
            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Saving…' : 'Save PIN & Finish'}
            </button>
          </div>
        </form>
      </Modal>
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
  fontSize: 16,
  WebkitTextSizeAdjust: '100%',
  minHeight: '40px',
  lineHeight: '1.35',
}
