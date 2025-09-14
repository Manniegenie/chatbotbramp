// src/SignUp.tsx
import React, { useState, useRef, useCallback } from 'react'
import Webcam from 'react-webcam'

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

type ServerError =
  | { success: false; message: string; errors?: any[] }
  | { success: false; message: string }

type StepId = 'firstname' | 'lastname' | 'phone' | 'email' | 'bvn' | 'otp' | 'pin' | 'id-type-selection' | 'id-number' | 'liveness-capture' | 'verification-processing' | 'verification-complete'

type IdType = 'nin' | 'drivers_license' | 'passport'

const LIVENESS_PROMPTS = [
  'Look straight at the camera',
  'Turn your head slightly to the left',
  'Turn your head slightly to the right', 
  'Look up slightly',
  'Look down slightly',
  'Smile naturally',
  'Keep a neutral expression',
  'Look straight again'
]

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
  const BIOMETRIC_VERIFICATION_ENDPOINT = `${API_BASE}/chatbot-kyc`
    
  const steps: StepId[] = ['firstname', 'lastname', 'phone', 'email', 'bvn', 'otp', 'pin', 'id-type-selection', 'id-number', 'liveness-capture', 'verification-processing', 'verification-complete']
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
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [userInfo, setUserInfo] = useState<any>(null)

  // New states for ID verification
  const [selectedIdType, setSelectedIdType] = useState<IdType | null>(null)
  const [idNumber, setIdNumber] = useState('')
  const [livenessImages, setLivenessImages] = useState<string[]>([])
  const [currentLivenessStep, setCurrentLivenessStep] = useState(0)
  const [showCamera, setShowCamera] = useState(false)
  const [verificationResults, setVerificationResults] = useState<{
    bvnResult?: BiometricVerificationResult
    idResult?: BiometricVerificationResult
  }>({})

  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentStepId = steps[stepIndex]

  // Webcam configuration
  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "user"
  }

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
      case 'liveness-capture':
        if (livenessImages.length < 8) return 'Please complete all liveness photos.'
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

  // ---------- Camera functions ----------
  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot()
    if (imageSrc) {
      setLivenessImages(prev => [...prev, imageSrc])
      
      if (currentLivenessStep < 7) {
        setCurrentLivenessStep(prev => prev + 1)
      } else {
        // All 8 photos taken, hide camera
        setShowCamera(false)
      }
    }
  }, [currentLivenessStep])

  const resetLivenessCapture = () => {
    setLivenessImages([])
    setCurrentLivenessStep(0)
    setShowCamera(false)
  }

  const startLivenessTest = () => {
    setShowCamera(true)
    setCurrentLivenessStep(0)
    setLivenessImages([])
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    // Handle multiple file selection for liveness images
    const fileArray = Array.from(files)
    if (fileArray.length !== 8) {
      setError('Please select exactly 8 images for the liveness test.')
      return
    }

    const promises = fileArray.map(file => {
      return new Promise<string>((resolve) => {
        if (!file.type.startsWith('image/')) {
          throw new Error('All files must be images.')
        }
        
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.readAsDataURL(file)
      })
    })

    Promise.all(promises)
      .then(images => {
        setLivenessImages(images)
        setCurrentLivenessStep(8)
      })
      .catch(err => {
        setError(err.message)
      })
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
      case 'liveness-capture':
        return doVerification()
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

      // Store user info and tokens for verification step
      setAccessToken(ok.accessToken)
      setRefreshToken(ok.refreshToken)
      setUserInfo(ok.user)

      // Move to ID type selection
      setStepIndex(steps.indexOf('id-type-selection'))

    } catch (err: any) {
      setPinError(`Network error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function doVerification() {
    if (!accessToken || !selectedIdType || !idNumber || livenessImages.length !== 8) {
      setError('Missing required information for verification.')
      return
    }

    setLoading(true)
    setStepIndex(steps.indexOf('verification-processing'))

    try {
      // Use the first liveness image as the main selfie and all 8 as liveness images
      const verification = await fetch(BIOMETRIC_VERIFICATION_ENDPOINT, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          idType: selectedIdType === 'drivers_license' ? 'drivers_license' : selectedIdType,
          idNumber: idNumber,
          selfieImage: livenessImages[0], // Use first liveness image as main selfie
          livenessImages: livenessImages
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
      setStepIndex(steps.indexOf('liveness-capture'))
    } finally {
      setLoading(false)
    }
  }

  // ---------- UI ----------
  function ProgressDots() {
    // Don't show progress dots on processing/complete screens
    if (['verification-processing', 'verification-complete'].includes(currentStepId)) return null
    
    const visibleSteps = steps.filter(s => !['verification-processing', 'verification-complete'].includes(s))
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
                {loading ? 'Saving…' : 'Save PIN & Continue'}
              </button>
            </div>
          </>
        )
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
      case 'id-number':
        return (
          <>
            <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              {selectedIdType === 'nin' && 'Enter your NIN (11 digits)'}
              {selectedIdType === 'drivers_license' && 'Enter your Driver\'s License Number'}
              {selectedIdType === 'passport' && 'Enter your Passport Number (e.g., A12345678)'}
            </label>
            <input
              key="id-number"
              placeholder={
                selectedIdType === 'nin' ? '12345678901' :
                selectedIdType === 'drivers_license' ? 'License number' :
                'A12345678'
              }
              value={idNumber}
              onChange={(e) => {
                if (selectedIdType === 'nin') {
                  setIdNumber(e.target.value.replace(/[^\d]/g, '').slice(0, 11))
                } else if (selectedIdType === 'passport') {
                  setIdNumber(e.target.value.toUpperCase().slice(0, 9))
                } else {
                  setIdNumber(e.target.value)
                }
              }}
              inputMode={selectedIdType === 'nin' ? 'numeric' : 'text'}
              maxLength={selectedIdType === 'nin' ? 11 : selectedIdType === 'passport' ? 9 : undefined}
              autoFocus
              style={inputStyle}
              className="no-zoom"
            />
          </>
        )
      case 'liveness-capture':
        return (
          <>
            <label style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 12, display: 'block' }}>
              Identity Verification - Take 8 photos ({livenessImages.length}/8)
            </label>
            
            {livenessImages.length < 8 ? (
              <>
                <div style={{ 
                  padding: 16, 
                  background: 'var(--card)', 
                  border: '2px solid var(--accent)', 
                  borderRadius: 8, 
                  marginBottom: 16, 
                  textAlign: 'center' 
                }}>
                  <div style={{ fontSize: '1rem', fontWeight: '500', marginBottom: 4 }}>
                    {LIVENESS_PROMPTS[currentLivenessStep]}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                    Hold still and click "Capture" when ready
                  </div>
                </div>

                {showCamera ? (
                  <div style={{ marginBottom: 16 }}>
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      videoConstraints={videoConstraints}
                      mirrored={true}
                      style={{
                        width: '100%',
                        maxWidth: 400,
                        borderRadius: 8,
                        border: '2px solid var(--border)'
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
                      <button
                        type="button"
                        className="btn"
                        onClick={capture}
                      >
                        📷 Capture ({livenessImages.length + 1}/8)
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={resetLivenessCapture}
                      >
                        Start Over
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ 
                      width: 200, 
                      height: 200, 
                      border: '2px dashed var(--border)', 
                      borderRadius: 8, 
                      margin: '0 auto 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 48
                    }}>
                      📷
                    </div>
                    
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
                      <button
                        type="button"
                        className="btn"
                        onClick={startLivenessTest}
                      >
                        Start Camera
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Upload 8 Photos
                      </button>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                  </div>
                )}

                {/* Show captured images */}
                {livenessImages.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 8 }}>
                      Captured photos:
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {livenessImages.map((image, index) => (
                        <img
                          key={index}
                          src={image}
                          alt={`Photo ${index + 1}`}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 4,
                            border: '1px solid var(--border)',
                            objectFit: 'cover'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ 
                  padding: 16, 
                  background: 'var(--card)', 
                  border: '2px solid #16a34a', 
                  borderRadius: 8, 
                  marginBottom: 16, 
                  textAlign: 'center' 
                }}>
                  <div style={{ fontSize: '1rem', fontWeight: '500', marginBottom: 4, color: '#16a34a' }}>
                    ✅ All photos captured!
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                    8 verification photos ready for processing
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 8 }}>
                    Verification photos:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {livenessImages.map((image, index) => (
                      <img
                        key={index}
                        src={image}
                        alt={`Photo ${index + 1}`}
                        style={{
                          width: '100%',
                          aspectRatio: '1',
                          borderRadius: 4,
                          border: '1px solid var(--border)',
                          objectFit: 'cover'
                        }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn btn-outline" onClick={goBack} disabled={loading}>
                Back
              </button>
              {livenessImages.length >= 8 && (
                <>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={resetLivenessCapture}
                  >
                    Retake All
                  </button>
                  <button className="btn" type="submit" disabled={loading}>
                    {loading ? 'Submitting…' : 'Submit for Verification'}
                  </button>
                </>
              )}
            </div>
          </>
        )
      case 'verification-processing':
        return (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
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
              Processing Verification...
            </p>
            
            <p style={{ 
              fontSize: '0.9rem', 
              color: 'var(--muted)', 
              margin: 0 
            }}>
              We're verifying your identity using advanced biometric analysis. This may take a moment.
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
      case 'verification-complete':
        return (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ 
              fontSize: '48px', 
              marginBottom: '16px' 
            }}>
              ✅
            </div>
            
            <p style={{ 
              fontSize: '1.1rem', 
              color: 'var(--txt)', 
              margin: '0 0 8px',
              fontWeight: '500'
            }}>
              Verification Submitted!
            </p>
            
            <p style={{ 
              fontSize: '0.9rem', 
              color: 'var(--muted)', 
              margin: '0 0 16px',
              lineHeight: '1.5'
            }}>
              Your account has been created and your biometric verification is being processed. 
              You'll receive an email notification once the verification is complete.
            </p>

            <p style={{ 
              fontSize: '0.8rem', 
              color: 'var(--muted)', 
              margin: 0 
            }}>
              This process usually takes 1-2 business days.
            </p>
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
                : currentStepId === 'id-type-selection'
                ? 'Choose ID Type'
                : currentStepId === 'id-number'
                ? 'Enter ID Number'
                : currentStepId === 'liveness-capture'
                ? 'Identity Verification'
                : currentStepId === 'verification-processing'
                ? 'Processing...'
                : currentStepId === 'verification-complete'
                ? 'All Done!'
                : 'Create your account'}
            </h2>
            <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
              {currentStepId === 'otp'
                ? 'Enter the 6-digit OTP sent to your phone.'
                : currentStepId === 'pin'
                ? 'Create a 6-digit PIN for sign-in and transactions.'
                : currentStepId === 'id-type-selection'
                ? 'Select an ID type for identity verification.'
                : currentStepId === 'id-number'
                ? 'Enter the number from your selected ID.'
                : currentStepId === 'liveness-capture'
                ? 'Take 8 photos following the prompts for biometric verification.'
                : currentStepId === 'verification-processing'
                ? 'Please wait while we process your information.'
                : currentStepId === 'verification-complete'
                ? 'Welcome aboard! Your verification is in progress.'
                : "We'll collect a few details. One step at a time."}
            </p>

            <ProgressDots />

            <form onSubmit={handleSubmit}>
              {renderStep()}

              {/* Default nav + error for the first 5 steps */}
              {['firstname', 'lastname', 'phone', 'email', 'bvn', 'id-number'].includes(currentStepId) && (
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
                We'll verify your identity using your BVN, a government-issued ID, and biometric photos.
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