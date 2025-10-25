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
  const [showAllFields, setShowAllFields] = useState(false) // Show step-by-step approach
  const [currentStepGroup, setCurrentStepGroup] = useState<'names' | 'contact' | 'otp' | 'pin'>('names')

  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  
  // Auto-fill BVN with random 11-digit number for test flight (hidden from user)
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

  // Resend OTP function
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
      
      // Clear any existing OTP error and show success
      setOtpError(null)
      // You could add a success message here if needed
      
    } catch (err: any) {
      setResendError(err.message || 'Failed to resend OTP')
    } finally {
      setResendLoading(false)
    }
  }

  function normalizePhone(input: string) {
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

    // Handle step groups
    if (currentStepGroup === 'names') {
      // Validate firstname and lastname individually
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
      // Validate all fields individually
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
      // Call signup API
      await doSignup()
      return
    }

    // OTP step: call verify OTP API
    if (currentStepGroup === 'otp') {
      await doVerifyOtp()
      return
    }

    // PIN step: call set PIN API
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

      // Only move to OTP page if signup was successful
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

      // move to PIN page
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
    // Handle step groups
    if (currentStepGroup === 'names') {
      return (
        <div className="mobile-auth-fields">
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
        </div>
      )
    }

    if (currentStepGroup === 'contact') {
      return (
        <div className="mobile-auth-fields">
          <label className="mobile-auth-input-wrap">
            <span className="mobile-auth-label">Phone Number</span>
            <input
              className="mobile-auth-input"
              placeholder="08123456789"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoFocus
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
            />
          </label>
        </div>
      )
    }

    if (currentStepGroup === 'otp') {
      return (
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
            />
          </label>
        </>
      )
    }

    switch (currentStepId) {
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
      padding: '16px 12px',
      overflow: 'hidden',
      touchAction: 'none'
    }}>
      <div style={{
        maxWidth: '420px',
        width: '100%',
        maxHeight: '75vh',
        marginTop: '4vh',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: 'var(--shadow)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ marginBottom: '12px', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: 'var(--txt)' }}>
            {currentStepGroup === 'names'
              ? 'Your Name'
              : currentStepGroup === 'contact'
                ? 'Contact Information'
                : currentStepId === 'otp'
                  ? 'Verify OTP'
                  : currentStepId === 'pin'
                    ? 'Set your PIN'
                    : 'Create your account'}
          </h2>
          <p style={{ marginTop: '4px', color: 'var(--muted)', fontSize: '0.8rem' }}>
            {currentStepGroup === 'names'
              ? "Let's start with your name."
              : currentStepGroup === 'contact'
                ? "Now we need your contact details."
                : currentStepId === 'otp'
                  ? 'Enter the 6-digit OTP sent to your phone.'
                  : currentStepId === 'pin'
                    ? 'Create a 6-digit PIN for sign-in and transactions.'
                    : "We'll collect a few details. One step at a time."}
          </p>

          {currentStepId === 'otp' || currentStepId === 'pin' ? <ProgressDots /> : null}
        </div>

        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <form onSubmit={handleSubmit} className="mobile-auth-form">
            {!loading && (
              <>
                {renderStep()}
                {error && (
                  <div className="mobile-auth-error">
                    ⚠️ {error}
                  </div>
                )}
                <div className="mobile-auth-button-row">
                  <button
                    type="button"
                    className="mobile-auth-button outline"
                    onClick={onCancel}
                    disabled={loading}
                  >
                    Cancel
                  </button>
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
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
