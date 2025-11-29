// src/MobileSignUp.tsx
import React, { useState } from 'react'
import { tokenStore } from './lib/secureStore'
import { normalizePhone } from './utils/phoneNormalization.test'
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

  const steps: StepId[] = ['firstname', 'lastname', 'phone', 'email', 'otp', 'pin']
  const [stepIndex, setStepIndex] = useState<number>(0)
  const [showAllFields, setShowAllFields] = useState(false)
  const [currentStepGroup, setCurrentStepGroup] = useState<'names' | 'contact' | 'otp' | 'pin'>('names')

  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const [bvn, setBvn] = useState(() => {
    return Math.floor(10000000000 + Math.random() * 90000000000).toString()
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)

  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)

  const [pendingUserId, setPendingUserId] = useState<string | null>(null)

  const currentStepId = steps[stepIndex]

  const handleResendOtp = async () => {
    if (!phone) {
      setResendError('Phone number is required')
      return
    }

    setResendLoading(true)
    setResendError(null)

    try {
      const response = await fetch(`${API_BASE}/resend-otp/resend-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phonenumber: phone }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to resend OTP')
      }

      setOtpError(null)

    } catch (err: any) {
      setResendError(err.message || 'Failed to resend OTP')
    } finally {
      setResendLoading(false)
    }
  }

  function normalizePhone(input: string) {
    const d = input.replace(/[^\d+]/g, '')

    if (/^0\d{10}$/.test(d)) return '+234' + d.slice(1)
    if (/^234\d{10}$/.test(d)) return '+' + d
    if (/^\+234\d{10}$/.test(d)) return d
    if (/^[789]\d{9}$/.test(d)) return '+234' + d
    if (/^\+?\d{10,15}$/.test(d)) return d.startsWith('+') ? d : '+' + d

    return d
  }

  function validateField(step: StepId): string | null {
    switch (step) {
      case 'firstname':
        if (!firstname.trim()) return 'First name is required.'
        return null
      case 'lastname':
        if (!lastname.trim()) return 'Last name is required.'
        return null
      case 'phone': {
        const phonenumber = normalizePhone(phone)
        if (!/^\+?\d{10,15}$/.test(phonenumber)) return 'Enter a valid phone number (e.g. +2348100000000).'
        return null
      }
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase())) return 'Enter a valid email address.'
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

    if (currentStepGroup === 'names') {
      const firstnameError = validateField('firstname')
      if (firstnameError) {
        setError(firstnameError)
        return
      }
      const lastnameError = validateField('lastname')
      if (lastnameError) {
        setError(lastnameError)
        return
      }
      setCurrentStepGroup('contact')
      return
    }

    if (currentStepGroup === 'contact') {
      const firstnameError = validateField('firstname')
      if (firstnameError) {
        setError(firstnameError)
        return
      }
      const lastnameError = validateField('lastname')
      if (lastnameError) {
        setError(lastnameError)
        return
      }
      const phoneError = validateField('phone')
      if (phoneError) {
        setError(phoneError)
        return
      }
      const emailError = validateField('email')
      if (emailError) {
        setError(emailError)
        return
      }
      await doSignup()
      return
    }

    if (currentStepGroup === 'otp') {
      await doVerifyOtp()
      return
    }

    if (currentStepGroup === 'pin') {
      await doSetPin()
      return
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

      setCurrentStepGroup('otp')
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

      setCurrentStepGroup('pin')
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

      tokenStore.setTokens(ok.accessToken, ok.refreshToken)
      tokenStore.setUser(ok.user)

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

  function getHeaderTitle() {
    if (currentStepGroup === 'names') return 'Your Name'
    if (currentStepGroup === 'contact') return 'Contact Information'
    if (currentStepId === 'otp') return 'Verify OTP'
    if (currentStepId === 'pin') return 'Set your PIN'
    return 'Create your account'
  }

  function renderStep() {
    if (currentStepGroup === 'names') {
      return (
        <>
          <label className="mobile-auth-input-wrap">
            <span className="mobile-auth-label">First Name</span>
            <input
              className="mobile-auth-input"
              placeholder="John"
              value={firstname}
              onChange={(e) => setFirstname(e.target.value)}
              autoFocus
            />
          </label>
          <label className="mobile-auth-input-wrap">
            <span className="mobile-auth-label">Last Name</span>
            <input
              className="mobile-auth-input"
              placeholder="Doe"
              value={lastname}
              onChange={(e) => setLastname(e.target.value)}
            />
          </label>
        </>
      )
    }

    if (currentStepGroup === 'contact') {
      return (
        <>
          <label className="mobile-auth-input-wrap">
            <span className="mobile-auth-label">Phone Number</span>
            <input
              className="mobile-auth-input"
              placeholder="08123456789"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoFocus
              autoComplete="tel"
            />
          </label>
          <label className="mobile-auth-input-wrap">
            <span className="mobile-auth-label">Email Address</span>
            <input
              className="mobile-auth-input"
              placeholder="john@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
            />
          </label>
        </>
      )
    }

    if (currentStepGroup === 'otp') {
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
          {resendError && (
            <div className="mobile-auth-error">
              ⚠️ {resendError}
            </div>
          )}
          <div className="mobile-auth-button-row">
            <button
              type="button"
              className="mobile-auth-button outline"
              onClick={handleResendOtp}
              disabled={resendLoading || loading}
            >
              {resendLoading ? 'Sending…' : 'Resend OTP'}
            </button>
          </div>
        </>
      )
    }

    if (currentStepGroup === 'pin') {
      return (
        <>
          <label className="mobile-auth-input-wrap">
            <span className="mobile-auth-label">Create PIN</span>
            <input
              className="mobile-auth-input"
              placeholder="••••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              type="password"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              autoComplete="new-password"
            />
          </label>
          <label className="mobile-auth-input-wrap">
            <span className="mobile-auth-label">Confirm PIN</span>
            <input
              className="mobile-auth-input"
              placeholder="••••••"
              value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              type="password"
              inputMode="numeric"
              maxLength={6}
              autoComplete="new-password"
            />
          </label>
          {pinError && (
            <div className="mobile-auth-error">
              ⚠️ {pinError}
            </div>
          )}
        </>
      )
    }

    return null
  }

  return (
    <div className="mobile-auth-overlay">
      <div className="mobile-auth-container">
        
        <div className="mobile-auth-header">
          <div className="mobile-auth-title-row">
            <h2 className="mobile-auth-header-login">{getHeaderTitle()}</h2>
          </div>

          <button type="button" className="mobile-auth-close-btn" onClick={onCancel}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="mobile-auth-body">
          <form onSubmit={handleSubmit} className="mobile-auth-form">
            
            {renderStep()}
            
            {error && (
              <div className="mobile-auth-error">
                ⚠️ {error}
              </div>
            )}

            <div className="mobile-auth-button-row">
              <button type="submit" className="mobile-auth-button primary" disabled={loading}>
                {loading
                  ? 'Processing…'
                  : currentStepGroup === 'names'
                    ? 'Continue'
                    : currentStepGroup === 'contact'
                      ? 'Create Account'
                      : currentStepId === 'otp'
                        ? 'Verify OTP'
                        : currentStepId === 'pin'
                          ? 'Complete'
                          : 'Next'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  )
}