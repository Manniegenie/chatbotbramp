// src/SignUp.tsx
import React, { useState, useRef, useCallback } from 'react'
// import Webcam from 'react-webcam' // Commented out for test flight
import { tokenStore } from './lib/secureStore'
import { normalizePhone } from './utils/phoneNormalization.test'

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

// KYC types commented out for test flight
/*
type BiometricVerificationResult = {
  success: boolean
  message: string
  data?: {
    jobId: string
    smileJobId: string
    resultCode: string
    resultText: string
    confidenceValue: number
    isApproved: boolean
    kycLevel: number
    kycStatus: string
  }
}
*/

type ServerError =
  | { success: false; message: string; errors?: any[] }
  | { success: false; message: string }

// KYC steps removed for test flight
type StepId = 'firstname' | 'lastname' | 'phone' | 'email' | 'bvn' | 'otp' | 'pin'

// KYC types commented out for test flight
// type IdType = 'nin' | 'drivers_license' | 'passport'

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
  const PASSWORD_PIN_ENDPOINT = `${API_BASE}/passwordpin/password-pin`
  // const BIOMETRIC_VERIFICATION_ENDPOINT = `${API_BASE}/chatbot-kyc/chatbot-kyc`  // Commented out for test flight

  // KYC steps removed for test flight - consolidated for testflight
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
  // const [accessToken, setAccessToken] = useState<string | null>(null) // Commented out for test flight

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
  // const [refreshToken, setRefreshToken] = useState<string | null>(null) // Commented out for test flight
  // const [userInfo, setUserInfo] = useState<any>(null) // Commented out for test flight

  // KYC states commented out for test flight
  /*
  const [selectedIdType, setSelectedIdType] = useState<IdType | null>(null)
  const [idNumber, setIdNumber] = useState('')
  const [selfieImage, setSelfieImage] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [verificationResults, setVerificationResults] = useState<{
    bvnResult?: BiometricVerificationResult
    idResult?: BiometricVerificationResult
  }>({})

  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  */

  const currentStepId = steps[stepIndex]

  // KYC webcam configuration commented out for test flight
  /*
  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "user"
  }
  */

  // ---------- Utils ----------
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

  // KYC image compression function commented out for test flight
  /*
  function compressImage(dataUrl: string, maxSizeKB = 80): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!
        
        // Calculate new dimensions (max 400px width)
        const maxWidth = 400
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height)
        canvas.width = img.width * ratio
        canvas.height = img.height * ratio
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        
        // Try different quality levels to get under size limit
        let quality = 0.8
        let compressed = canvas.toDataURL('image/jpeg', quality)
        
        while (compressed.length > maxSizeKB * 1024 && quality > 0.1) {
          quality -= 0.1
          compressed = canvas.toDataURL('image/jpeg', quality)
        }
        
        resolve(compressed)
      }
      img.src = dataUrl
    })
  }
  */

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
      // KYC validation cases commented out for test flight
      /*
      case 'id-type-selection':
        if (!selectedIdType) return 'Please select an ID type.'
        return null
      case 'id-number':
        if (!idNumber.trim()) return 'Please enter your ID number.'
        // Validate based on selected ID type
        if (selectedIdType === 'nin' && !/^\d{11}$/.test(idNumber)) return 'NIN must be exactly 11 digits.'
        if (selectedIdType === 'passport' && !/^[A-Z]\d{8}$/.test(idNumber.toUpperCase())) return 'Passport must be 1 letter followed by 8 digits.'
        if (selectedIdType === 'drivers_license' && idNumber.length < 8) return 'Please enter a valid driver\'s license number.'
        return null
      case 'photo-capture':
        if (!selfieImage) return 'Please take a photo.'
        return null
      */
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

  // KYC camera functions commented out for test flight
  /*
  const capture = useCallback(async () => {
    const imageSrc = webcamRef.current?.getScreenshot()
    if (imageSrc) {
      setLoading(true)
      try {
        const compressed = await compressImage(imageSrc, 80) // 80KB max
        setSelfieImage(compressed)
        setShowCamera(false)
      } catch (err) {
        setError('Failed to process image. Please try again.')
      } finally {
        setLoading(false)
      }
    }
  }, [])

  const startCamera = () => {
    setShowCamera(true)
    setError(null)
  }

  const stopCamera = () => {
    setShowCamera(false)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }

    setLoading(true)
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string
        const compressed = await compressImage(dataUrl, 80) // 80KB max
        setSelfieImage(compressed)
        setLoading(false)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      setError('Failed to process image. Please try again.')
      setLoading(false)
    }
  }
  */

  // ---------- Submit router ----------
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
      setCurrentStepGroup('otp')
      setStepIndex(4) // Go to OTP step (index 4 in the steps array)
      return doSignup()
    }

    const invalid = validateAllUpTo(stepIndex)
    if (invalid) {
      setError(invalid)
      const firstBad = steps.slice(0, stepIndex + 1).findIndex((s) => validateField(s))
      if (firstBad >= 0) setStepIndex(firstBad)
      return
    }

    switch (currentStepId) {
      case 'otp':
        return doVerifyOtp()
      case 'pin':
        return doSetPin()
      // KYC case commented out for test flight
      // case 'photo-capture':
      //   return doVerification()
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

      // Store tokens and user info in secure storage
      tokenStore.setTokens(ok.accessToken, ok.refreshToken)
      tokenStore.setUser(ok.user)

      // For test flight: Complete signup after PIN is set (skip KYC)
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

  // KYC verification function commented out for test flight
  /*
  async function doVerification() {
    if (!accessToken || !selectedIdType || !idNumber || !selfieImage) {
      setError('Missing required information for verification.')
      return
    }

    setLoading(true)
    setStepIndex(steps.indexOf('verification-processing'))

    try {
      const verification = await fetch(BIOMETRIC_VERIFICATION_ENDPOINT, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          idType: selectedIdType === 'drivers_license' ? 'drivers_license' : selectedIdType,
          idNumber: idNumber,
          selfieImage: selfieImage
        }),
      })

      const result: BiometricVerificationResult = await verification.json()

      // Move to completion screen regardless of results
      setStepIndex(steps.indexOf('verification-complete'))

      // Call onSuccess with the user info
      onSuccess({
        success: true,
        message: 'Account created successfully. Verification submitted.',
        userId: userInfo?.id,
        accessToken: accessToken ?? undefined,
        refreshToken: refreshToken ?? undefined,
        user: {
          firstname,
          lastname,
          email,
          phonenumber: normalizePhone(phone),
          bvn,
          username: userInfo?.username,
        },
      })

    } catch (err: any) {
      setError(`Verification error: ${err.message}`)
      setStepIndex(steps.indexOf('photo-capture'))
    } finally {
      setLoading(false)
    }
  }
  */

  // ---------- UI ----------
  function ProgressDots() {
    // KYC progress dots logic removed for test flight
    const visibleSteps = steps
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
    // Handle step groups
    if (currentStepGroup === 'names') {
      return (
        <div style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>First Name</span>
            <input
              key="firstname"
              placeholder="John"
              value={firstname}
              onChange={e => setFirstname(e.target.value)}
              autoFocus
              style={inputStyle}
              className="no-zoom"
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Last Name</span>
            <input
              key="lastname"
              placeholder="Doe"
              value={lastname}
              onChange={e => setLastname(e.target.value)}
              style={inputStyle}
              className="no-zoom"
            />
          </label>
        </div>
      )
    }

    if (currentStepGroup === 'contact') {
      return (
        <div style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Phone Number</span>
            <input
              key="phone"
              placeholder="08123456789"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              inputMode="tel"
              autoFocus
              style={inputStyle}
              className="no-zoom"
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Email Address</span>
            <input
              key="email"
              placeholder="john@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              inputMode="email"
              style={inputStyle}
              className="no-zoom"
            />
          </label>
        </div>
      )
    }

    if (currentStepGroup === 'otp') {
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
          {resendError && (
            <div style={{ color: '#fda4af', marginTop: 8, fontSize: '0.8rem' }}>
              ⚠️ {resendError}
            </div>
          )}
        </>
      )
    }

    if (currentStepGroup === 'pin') {
      return (
        <>
          <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Create PIN</label>
          <input
            key="pin"
            placeholder="••••••"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
            type="password"
            inputMode="numeric"
            maxLength={6}
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
            type="password"
            inputMode="numeric"
            maxLength={6}
            style={inputStyle}
            className="no-zoom"
          />
          {pinError && (
            <div style={{ color: '#fda4af', marginTop: 8, fontSize: '0.8rem' }}>
              ⚠️ {pinError}
            </div>
          )}
        </>
      )
    }

    switch (currentStepId) {
      case 'phone':
        return (
          <>
            <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Phone number</label>
            <input
              key="ph"
              placeholder="+2348172345678"
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
              placeholder="adunni.okafor@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
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
            {resendError && (
              <div style={{ color: '#fda4af', marginTop: 8, fontSize: '0.8rem' }}>
                ⚠️ {resendError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn" type="submit" disabled={loading}>
                {loading ? 'Verifying…' : 'Verify OTP'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleResendOtp}
                disabled={resendLoading || loading}
                style={{ fontSize: '0.8rem' }}
              >
                {resendLoading ? 'Sending…' : 'Resend OTP'}
              </button>
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
                {loading ? 'Creating Account…' : 'Complete Signup'}
              </button>
            </div>
          </>
        )

      // KYC render cases commented out for test flight
      /*
      case 'id-type-selection':
        return (
          <>
            <label style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 12, display: 'block' }}>
              Choose an ID type for verification
            </label>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { value: 'nin', label: 'National Identification Number (NIN)', description: '11-digit number' },
                { value: 'drivers_license', label: 'Driver\'s License', description: 'Valid Nigerian driver\'s license' },
                { value: 'passport', label: 'International Passport', description: 'Letter + 8 digits format' }
              ].map((option) => (
                <div
                  key={option.value}
                  onClick={() => setSelectedIdType(option.value as IdType)}
                  style={{
                    padding: 16,
                    border: `2px solid ${selectedIdType === option.value ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: selectedIdType === option.value ? 'rgba(var(--accent-rgb), 0.1)' : 'var(--card)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ fontWeight: '500', color: 'var(--txt)', marginBottom: 4 }}>
                    {option.label}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                    {option.description}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn btn-outline" onClick={goBack} disabled={loading}>
                Back
              </button>
              <button 
                className="btn" 
                onClick={goNext} 
                disabled={!selectedIdType}
              >
                Continue
              </button>
            </div>
          </>
        )
      // ... other KYC cases
      */
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
      padding: '20px 16px',
      overflow: 'hidden',
      touchAction: 'none'
    }}>
      <div style={{
        maxWidth: '360px',
        width: '100%',
        maxHeight: '70vh',
        marginTop: '10vh',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: 'var(--shadow)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ marginBottom: '16px', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 600, color: 'var(--txt)' }}>
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
          <p style={{ marginTop: '6px', color: 'var(--muted)', fontSize: '0.85rem' }}>
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

          {currentStepGroup === 'otp' || currentStepGroup === 'pin' ? <ProgressDots /> : null}
        </div>
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <form onSubmit={handleSubmit}>
              {!loading && (
                <>
                  {renderStep()}
                  {error && (
                    <div style={{ color: '#fda4af', marginTop: 8, fontSize: '0.8rem' }}>
                      ⚠️ {error}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={onCancel}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn" disabled={loading}>
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