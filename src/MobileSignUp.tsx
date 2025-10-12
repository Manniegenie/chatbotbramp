// src/MobileSignUp.tsx
import React, { useState } from 'react'
import './mobile-auth.css'

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
  userId?: string
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

type StepId = 'firstname' | 'lastname' | 'phone' | 'email' | 'bvn' | 'otp' | 'pin'

type SignUpProps = {
  onSuccess: (result: SignUpResult) => void
  onCancel: () => void
}

export default function MobileSignUp({ onSuccess, onCancel }: SignUpProps) {
  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'
  const SIGNUP_ENDPOINT = `${API_BASE}/chatsignup/add-user`
  const VERIFY_OTP_ENDPOINT = `${API_BASE}/verify-otp/verify-otp`
  const PASSWORD_PIN_ENDPOINT = `${API_BASE}/passwordpin/password-pin`

  const steps: StepId[] = ['firstname', 'lastname', 'phone', 'email', 'bvn', 'otp', 'pin']
  const [stepIndex, setStepIndex] = useState<number>(0)

  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  
  // Auto-fill BVN with random 11-digit number for test flight
  const [bvn, setBvn] = useState(() => {
    return Math.floor(10000000000 + Math.random() * 90000000000).toString()
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)

  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)

  const [pendingUserId, setPendingUserId] = useState<string | null>(null)

  const currentStepId = steps[stepIndex]

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
        if (!/^\+?\d{10,15}$/.test(phonenumber)) return 'Enter a valid phone number (e.g. +2348100000000).'
        return null
      }
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase())) return 'Enter a valid email address.'
        return null
      case 'bvn':
        if (!/^\d{11}$/.test(bvn)) return 'BVN must be exactly 11 digits.'
        return null
      case 'otp':
        if (!/^\d{6}$/.test(otp)) return 'OTP must be a 6-digit number.'
        return null
      case 'pin':
        if (!/^\d{6}$/.test(pin)) return 'PIN must be exactly 6 digits.'
        if (pin !== pin2) return 'PINs do not match.'
        if (!pendingUserId) return 'Missing pending user ID. Please repeat verification.'
        return null
      default:
        return null
    }
  }

  function validateAllUpTo(index: number): string | null {
    for (let i = 0; i <= index; i++) {
      const v = validateField(steps[i])
      if (v) return v
    }
    return null
  }

  function goNext() {
    setError(null)
    const invalid = validateField(currentStepId)
    if (invalid) return setError(invalid)
    setStepIndex((i) => Math.min(i + 1, steps.length - 1))
  }

  function goBack() {
    setError(null)
    setStepIndex((i) => Math.max(i - 1, 0))
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    setError(null)

    const invalid = validateAllUpTo(stepIndex)
    if (invalid) {
      setError(invalid)
      const firstBad = steps.slice(0, stepIndex + 1).findIndex((s) => validateField(s))
      if (firstBad >= 0) setStepIndex(firstBad)
      return
    }

    switch (currentStepId) {
      case 'bvn':
        return doSignup()
      case 'otp':
        return doVerifyOtp()
      case 'pin':
        return doSetPin()
      default:
        return goNext()
    }
  }

  async function doSignup() {
    setLoading(true)
    try {
      const phonenumber = normalizePhone(phone)
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

      // move to OTP page
      setStepIndex(steps.indexOf('otp'))
    } catch (err: any) {
      setError(`Network error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function doVerifyOtp() {
    setOtpError(null)

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

      // move to PIN page
      setStepIndex(steps.indexOf('pin'))
    } catch (err: any) {
      setOtpError(`Network error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function doSetPin() {
    setPinError(null)

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

      // Store tokens and user info in secure storage
      tokenStore.setTokens(ok.accessToken, ok.refreshToken)
      tokenStore.setUser(ok.user)

      // Complete signup after PIN is set
      onSuccess({
        success: true,
        message: 'Account created successfully!',
        userId: ok.user.id,
        accessToken: ok.accessToken,
        refreshToken: ok.refreshToken,
        user: {
          firstname,
          lastname,
          email,
          phonenumber: normalizePhone(phone),
          bvn,
          username: ok.user.username,
        },
      })

    } catch (err: any) {
      setPinError(`Network error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function ProgressDots() {
    const visibleSteps = steps
    const currentVisibleIndex = visibleSteps.indexOf(currentStepId)
    
    return (
      <div className="mobile-auth-progress">
        {visibleSteps.map((_, i) => (
          <span
            key={i}
            className={`mobile-auth-dot ${i === currentVisibleIndex ? 'active' : ''}`}
          />
        ))}
      </div>
    )
  }

  function renderStep() {
    switch (currentStepId) {
      case 'firstname':
        return (
          <label className="mobile-auth-input-wrap">
            <span className="mobile-auth-label">First name</span>
            <input
              className="mobile-auth-input"
              placeholder="Chibuike"
              value={firstname}
              onChange={(e) => setFirstname(e.target.value)}
              autoFocus
            />
          </label>
        )
      case 'lastname':
        return (
          <label className="mobile-auth-input-wrap">
            <span className="mobile-auth-label">Surname</span>
            <input
              className="mobile-auth-input"
              placeholder="Nwogbo"
              value={lastname}
              onChange={(e) => setLastname(e.target.value)}
              autoFocus
            />
          </label>
        )
      case 'phone':
        return (
          <label className="mobile-auth-input-wrap">
            <span className="mobile-auth-label">Phone number</span>
            <div className="mobile-auth-phone-input">
              <span className="mobile-auth-phone-prefix">+234</span>
              <input
                className="mobile-auth-input"
                placeholder="8141751569"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoFocus
              />
            </div>
          </label>
        )
      case 'email':
        return (
          <label className="mobile-auth-input-wrap">
            <span className="mobile-auth-label">Email address</span>
            <input
              className="mobile-auth-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoFocus
            />
          </label>
        )
      case 'bvn':
        return (
          <label className="mobile-auth-input-wrap">
            <span className="mobile-auth-label">BVN (11 digits)</span>
            <input
              className="mobile-auth-input"
              placeholder="12345678901"
              value={bvn}
              onChange={(e) => setBvn(e.target.value.replace(/[^\d]/g, '').slice(0, 11))}
              inputMode="numeric"
              maxLength={11}
              autoFocus
            />
            <div className="mobile-auth-hint">
              💡 Pre-filled for test flight - not validated
            </div>
          </label>
        )
      case 'otp':
        return (
          <>
            <label className="mobile-auth-input-wrap">
              <span className="mobile-auth-label">Enter OTP</span>
              <input
                className="mobile-auth-input"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                autoFocus
              />
            </label>
            {otpError && (
              <div className="mobile-auth-error">
                ⚠️ {otpError}
              </div>
            )}
          </>
        )
      case 'pin':
        return (
          <>
            <label className="mobile-auth-input-wrap">
              <span className="mobile-auth-label">PIN (6 digits)</span>
              <input
                className="mobile-auth-input"
                placeholder="••••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                type="password"
                autoFocus
              />
            </label>

            <label className="mobile-auth-input-wrap">
              <span className="mobile-auth-label">Confirm PIN</span>
              <input
                className="mobile-auth-input"
                placeholder="••••••"
                value={pin2}
                onChange={(e) => setPin2(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                type="password"
              />
            </label>

            {pinError && (
              <div className="mobile-auth-error">
                ⚠️ {pinError}
              </div>
            )}
          </>
        )
      default:
        return null
    }
  }

  return (
    <div className="mobile-auth-overlay" onClick={onCancel}>
      <div className="mobile-auth-container" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-auth-header">
          <div className="mobile-auth-title-row">
            <div className="mobile-auth-icon">📝</div>
            <h2 className="mobile-auth-title">
              {currentStepId === 'otp'
                ? 'Verify OTP'
                : currentStepId === 'pin'
                ? 'Set your PIN'
                : 'Create your account'}
            </h2>
          </div>
          <button type="button" className="mobile-auth-close" onClick={onCancel}>✕</button>
        </div>

        <div className="mobile-auth-body">
          <p className="mobile-auth-description">
            {currentStepId === 'otp'
              ? 'Enter the 6-digit OTP sent to your phone.'
              : currentStepId === 'pin'
              ? 'Create a 6-digit PIN for sign-in and transactions.'
              : "We'll collect a few details. One step at a time."}
          </p>

          <ProgressDots />

          <form onSubmit={handleSubmit} className="mobile-auth-form">
            {renderStep()}

            {/* Default nav + error for the basic signup steps */}
            {['firstname', 'lastname', 'phone', 'email', 'bvn'].includes(currentStepId) && (
              <>
                {error && (
                  <div className="mobile-auth-error">
                    ⚠️ {error}
                  </div>
                )}
                <div className="mobile-auth-button-row">
                  {stepIndex > 0 ? (
                    <button
                      type="button"
                      className="mobile-auth-button outline"
                      onClick={goBack}
                      disabled={loading}
                    >
                      Back
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="mobile-auth-button outline"
                      onClick={onCancel}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  )}

                  <button type="submit" className="mobile-auth-button primary" disabled={loading}>
                    {loading
                      ? currentStepId === 'bvn'
                        ? 'Creating…'
                        : 'Please wait…'
                      : currentStepId === 'bvn'
                      ? 'Create account'
                      : 'Next'}
                  </button>
                </div>
              </>
            )}

            {/* OTP step buttons */}
            {currentStepId === 'otp' && (
              <div className="mobile-auth-button-row">
                <button
                  type="button"
                  className="mobile-auth-button outline"
                  onClick={goBack}
                  disabled={loading}
                >
                  Back
                </button>
                <button type="submit" className="mobile-auth-button primary" disabled={loading}>
                  {loading ? 'Verifying…' : 'Verify OTP'}
                </button>
              </div>
            )}

            {/* PIN step buttons */}
            {currentStepId === 'pin' && (
              <div className="mobile-auth-button-row">
                <button
                  type="button"
                  className="mobile-auth-button outline"
                  onClick={goBack}
                  disabled={loading}
                >
                  Back
                </button>
                <button type="submit" className="mobile-auth-button primary" disabled={loading}>
                  {loading ? 'Creating Account…' : 'Complete Signup'}
                </button>
              </div>
            )}

            {currentStepId === 'firstname' && (
              <p className="mobile-auth-note">
                🧪 Test flight mode - simplified signup flow
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
