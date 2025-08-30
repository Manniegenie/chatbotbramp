import React, { useMemo, useState } from 'react'

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

type Props = {
  onCancel: () => void
  onSuccess: (res: SignUpResult) => void
}

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'

// ---- Strong types for form + keys ----
type SignUpForm = {
  firstname: string
  lastname: string
  phonenumber: string
  email: string
  dob: string
  bvn: string
}
type SignUpField = keyof SignUpForm
type Validators = { [K in SignUpField]: (v: string) => '' | string }

const initial: SignUpForm = {
  firstname: '',
  lastname: '',
  phonenumber: '',
  email: '',
  dob: '',
  bvn: '',
}

export default function SignUp({ onCancel, onSuccess }: Props) {
  const [form, setForm] = useState<SignUpForm>(initial)
  const [errors, setErrors] = useState<Partial<Record<SignUpField, string>>>({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  function set<K extends SignUpField>(key: K, val: string) {
    setForm(prev => ({ ...prev, [key]: val }))
    setErrors(prev => ({ ...prev, [key]: '' }))
    setServerError(null)
  }

  const isAdult = (iso: string) => {
    if (!iso) return false
    const dob = new Date(iso)
    if (Number.isNaN(dob.getTime())) return false
    const now = new Date()
    const hadBirthdayThisYear =
      now >= new Date(now.getFullYear(), dob.getMonth(), dob.getDate())
    const age = now.getFullYear() - dob.getFullYear() - (hadBirthdayThisYear ? 0 : 1)
    return age >= 18
  }

  const validators = useMemo<Validators>(
    () => ({
      firstname: (v: string) =>
        v.trim().length >= 2 ? '' : 'Enter a valid first name',
      lastname: (v: string) =>
        v.trim().length >= 2 ? '' : 'Enter a valid surname',
      email: (v: string) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Enter a valid email',
      phonenumber: (v: string) => {
        const digits = v.replace(/\D/g, '')
        return digits.length >= 10 && digits.length <= 15
          ? ''
          : 'Enter a valid phone number'
      },
      dob: (v: string) => (isAdult(v) ? '' : 'You must be at least 18 years old'),
      bvn: (v: string) => (/^\d{11}$/.test(v) ? '' : 'BVN must be 11 digits'),
    }),
    []
  )

  function validateAll(): boolean {
    const next: Partial<Record<SignUpField, string>> = {}
    ;(Object.keys(initial) as SignUpField[]).forEach((k: SignUpField) => {
      const err = validators[k](form[k])
      if (err) next[k] = err
    })
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    if (loading) return
    if (!validateAll()) return

    setLoading(true)
    setServerError(null)
    try {
      const payload = {
        firstname: form.firstname.trim(),
        lastname: form.lastname.trim(),
        phonenumber: form.phonenumber.trim(),
        email: form.email.trim().toLowerCase(),
        dob: form.dob,         // YYYY-MM-DD
        dateOfBirth: form.dob, // alias for backend compatibility
        bvn: form.bvn.trim(),
      }

      const res = await fetch(`${API_BASE}/signup/add-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`)

      onSuccess({
        success: true,
        message:
          data?.message ||
          'Account created. Please verify OTP to complete your signup.',
        user: payload,
      })
    } catch (err: any) {
      setServerError(err?.message || 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal">
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="signup-title">
        <div className="modal-head">
          <h3 id="signup-title">Create your Bramp account</h3>
        </div>

        <form className="modal-body" onSubmit={submit}>
          {serverError && (
            <div className="error" role="alert" style={{ marginBottom: 12 }}>
              {serverError}
            </div>
          )}

          <div className="grid-2">
            <label className="field">
              <span>First name</span>
              <input
                value={form.firstname}
                onChange={e => set('firstname', e.target.value)}
                placeholder="e.g., Chibuike"
                autoFocus
              />
              {errors.firstname && <small className="error">{errors.firstname}</small>}
            </label>

            <label className="field">
              <span>Surname</span>
              <input
                value={form.lastname}
                onChange={e => set('lastname', e.target.value)}
                placeholder="e.g., Nwogbo"
              />
              {errors.lastname && <small className="error">{errors.lastname}</small>}
            </label>
          </div>

          <label className="field">
            <span>Phone number</span>
            <input
              inputMode="tel"
              value={form.phonenumber}
              onChange={e => set('phonenumber', e.target.value)}
              placeholder="+2348012345678"
            />
            {errors.phonenumber && <small className="error">{errors.phonenumber}</small>}
          </label>

          <label className="field">
            <span>Email address</span>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="you@example.com"
            />
            {errors.email && <small className="error">{errors.email}</small>}
          </label>

          <div className="grid-2">
            <label className="field">
              <span>Date of birth</span>
              <input
                type="date"
                value={form.dob}
                onChange={e => set('dob', e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
              />
              {errors.dob && <small className="error">{errors.dob}</small>}
            </label>

            <label className="field">
              <span>BVN</span>
              <input
                inputMode="numeric"
                value={form.bvn}
                onChange={e =>
                  set('bvn', e.target.value.replace(/\D/g, '').slice(0, 11))
                }
                placeholder="11 digits"
                maxLength={11}
              />
              {errors.bvn && <small className="error">{errors.bvn}</small>}
            </label>
          </div>

          <div className="modal-foot">
            <button
              type="button"
              className="btn"
              style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--txt)' }}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Creating…' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
