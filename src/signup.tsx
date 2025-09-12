// src/SignUp.tsx
import React, { useState } from 'react'

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

type StepId = 'firstname' | 'lastname' | 'phone' | 'email' | 'bvn' | 'otp' | 'pin' | 'kyc-redirect'

export default function SignUp({
  onSuccess,
  onCancel,
}: {
  onSuccess: (result: SignUpResult) => void
  onCancel: () => void
}) {
  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'
  const SIGNUP_ENDPOINT = `${API_BASE}/chatsignup/add-user`
  const VERIFY_OTP_ENDPOINT = `${API_BASE}/verify-otp/verify-otp`         // { phonenumber, code }
  const PASSWORD_PIN_ENDPOINT = `${API_BASE}/passwordpin/password-pin`    // { newPin, renewPin, pendingUserId }

  // Use the latest link from your snippet
  const KYC_REDIRECT_URL =
    'https://links.sandbox.usesmileid.com/7932/1e917af3-62b5-4cbd-a3a6-4c40f0e0d099'
    
  const steps: StepId[] = ['firstname', 'lastname', 'phone', 'email', 'bvn', 'otp', 'pin', 'kyc-redirect']
  const [stepIndex, setStepIndex] = useState<number>(0)

  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [bvn, setBvn] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)

  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)

  const [pendingUserId, setPendingUserId] = useState<string | null>(null)

  const currentStepId = steps[stepIndex]

  // ---------- Utils ----------
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
      case 'kyc-redirect':
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

  // ---------- Submit router ----------
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

  // ---------- API handlers ----------
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

      // Show KYC loading screen
      setStepIndex(steps.indexOf('kyc-redirect'))
      
      // Generate user-specific KYC URL and redirect after delay
      setTimeout(async () => {
        try {
          // Generate personalized KYC URL with user ID
          const kycUrlResponse = await fetch(`${API_BASE}/smileid-redirect/kyc-url`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${ok.accessToken}`
            },
            body: JSON.stringify({ 
              userId: ok.user?.id,
              jobId: `job_${ok.user?.id}_${Date.now()}`
            }),
          })

          if (kycUrlResponse.ok) {
            const { kycUrl } = await kycUrlResponse.json()
            window.location.replace(kycUrl)
          } else {
            // Fallback to static URL with user ID as parameter
            const fallbackUrl = `${KYC_REDIRECT_URL}?user_id=${ok.user?.id}&job_id=job_${ok.user?.id}_${Date.now()}`
            window.location.replace(fallbackUrl)
          }
        } catch (error) {
          // If API fails, use fallback URL with user parameters
          const fallbackUrl = `${KYC_REDIRECT_URL}?user_id=${ok.user?.id}&job_id=job_${ok.user?.id}_${Date.now()}`
          window.location.replace(fallbackUrl)
        }
      }, 2000) // 2 second delay to show the loading message

    } catch (err: any) {
      setPinError(`Network error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ---------- UI ----------
  function ProgressDots() {
    // Don't show progress dots on the KYC redirect screen
    if (currentStepId === 'kyc-redirect') return null
    
    const visibleSteps = steps.filter(s => s !== 'kyc-redirect')
    const currentVisibleIndex = visibleSteps.indexOf(currentStepId)
    
    return (
      <div style={{ display: 'flex', gap: 6, margin: '6px 0 10px' }} aria-hidden>
        {visibleSteps.map((_, i) => (
          <span
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: i === currentVisibleIndex ? 'var(--accent)' : '#242433',
              display: 'inline-block',
              opacity: i === currentVisibleIndex ? 1 : 0.7,
            }}
          />
        ))}
      </div>
    )
  }

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
      case 'otp':
        return (
          <>
            <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Enter OTP</label>
            <input
              key="otp"
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

              {/* Temporarily disabled to avoid missing function error
              <button
                type="button"
                className="btn btn-outline"
                onClick={resendOtp}
                disabled={loading}
              >
                Resend OTP
              </button>
              */}

              <button
                type="button"
                className="btn btn-outline"
                onClick={goBack}
                disabled={loading}
              >
                Back
              </button>
            </div>
          </>
        )
      case 'pin':
        return (
          <>
            <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>PIN (6 digits)</label>
            <input
              key="pin1"
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
              key="pin2"
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
              <button type="button" className="btn btn-outline" onClick={goBack} disabled={loading}>
                Back
              </button>
              <button className="btn" type="submit" disabled={loading}>
                {loading ? 'Saving…' : 'Save PIN & Finish'}
              </button>
            </div>
          </>
        )
      case 'kyc-redirect':
        return (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            {/* Loading spinner */}
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid var(--border)',
              borderTop: '3px solid var(--accent)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }} />
            
            <p style={{ 
              fontSize: '1rem', 
              color: 'var(--txt)', 
              margin: '0 0 8px',
              fontWeight: '500'
            }}>
              Account Created Successfully!
            </p>
            
            <p style={{ 
              fontSize: '0.9rem', 
              color: 'var(--muted)', 
              margin: 0 
            }}>
              Please wait while we redirect you to complete your KYC verification...
            </p>

            <style>
              {`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}
            </style>
          </div>
        )
    }
  }

  return (
    <div className="chat" style={{ width: '100%', maxWidth: '100vw', padding: '8px 10px 0' }}>
      <div className="messages" style={{ paddingTop: 0 }}>
        <div className="bubble" style={{ maxWidth: '95%' }}>
          <div className="role">Security</div>
          <div className="text">
            <h2 id="signup-title" style={{ marginTop: 0, marginBottom: 6, fontSize: '1.2rem' }}>
              {currentStepId === 'otp'
                ? 'Verify OTP'
                : currentStepId === 'pin'
                ? 'Set your PIN'
                : currentStepId === 'kyc-redirect'
                ? 'Redirecting to KYC'
                : 'Create your account'}
            </h2>
            <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
              {currentStepId === 'otp'
                ? 'Enter the 6-digit OTP sent to your phone.'
                : currentStepId === 'pin'
                ? 'Create a 6-digit PIN for sign-in and transactions.'
                : currentStepId === 'kyc-redirect'
                ? 'Completing your registration process...'
                : "We'll collect a few details. One step at a time."}
            </p>

            <ProgressDots />

            <form onSubmit={handleSubmit}>
              {renderStep()}

              {/* Default nav + error for the first 5 steps */}
              {['firstname', 'lastname', 'phone', 'email', 'bvn'].includes(currentStepId) && (
                <>
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

                    <button type="submit" className="btn" disabled={loading}>
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
            </form>

            {currentStepId === 'firstname' && (
              <p style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--muted)' }}>
                We'll send an OTP to verify your phone.
              </p>
            )}
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
  fontSize: 16,
  WebkitTextSizeAdjust: '100%',
  minHeight: '40px',
  lineHeight: '1.35',
}