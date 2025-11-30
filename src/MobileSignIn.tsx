// Updated MobileSignIn Component with separate classes for header login text and close button
// Header now says "Login" and has its own class: mobile-auth-header-login
// Close button now has: mobile-auth-close-btn

import React, { useState, useEffect } from 'react'
import './mobile-auth.css'

const tokenStore = {
  setTokens: (accessToken, refreshToken) => {
    try {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    } catch (e) {
      console.error('Error saving tokens', e);
    }
  },
  setUser: (user) => {
    try {
      localStorage.setItem('user', JSON.stringify(user));
    } catch (e) {
      console.error('Error saving user', e);
    }
  }
};

export default function MobileSignIn({ onSuccess, onCancel }) {
  const API_BASE = 'https://priscaai.online';
  const ENDPOINT = `${API_BASE}/signin/signin-pin`;

  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const savedPhone = localStorage.getItem('rememberedPhone');
    if (savedPhone) setPhone(savedPhone);
  }, []);

  function normalizePhone(input) {
    const d = input.replace(/[^\d+]/g, '');
    if (/^0\d{10}$/.test(d)) return '+234' + d.slice(1);
    if (/^234\d{10}$/.test(d)) return '+' + d;
    if (/^\+234\d{10}$/.test(d)) return d;
    if (/^[789]\d{9}$/.test(d)) return '+234' + d;
    if (/^\+?\d{10,15}$/.test(d)) return d.startsWith('+') ? d : '+' + d;
    return d;
  }

  function handlePhoneChange(v) {
    let digits = v.replace(/\D/g, '').slice(0, 11);
    setPhone(digits);
  }

  async function submit(e) {
    e?.preventDefault();
    if (loading) return;

    setError(null);
    const phonenumber = normalizePhone(phone);
    const passwordpin = String(pin).replace(/[^\d]/g, '').padStart(6, '0');

    if (!/^\+234\d{10}$/.test(phonenumber)) return setError('Enter a valid Nigerian phone number.');
    if (!/^\d{6}$/.test(passwordpin)) return setError('PIN must be exactly 6 digits.');

    setLoading(true);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phonenumber, passwordpin })
      });

      const data = await res.json().catch(() => ({ success: false, message: 'Unexpected server response.' }));

      if (!res.ok || !data.success) {
        if (data.minutesRemaining) {
          setError(`${data.message} (${data.minutesRemaining} minutes remaining)`);
        } else {
          setError(data.message || `Sign-in failed (HTTP ${res.status}).`);
        }
        return;
      }

      tokenStore.setTokens(data.accessToken, data.refreshToken);
      tokenStore.setUser(data.user);
      localStorage.setItem('rememberedPhone', phone);

      onSuccess({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mobile-auth-overlay">
      <div className="mobile-auth-container">

        <div className="mobile-auth-header">
          <div className="mobile-auth-title-row">
            
            <h2 className="mobile-auth-header-login">Log In</h2>
          </div>

          <button type="button" className="mobile-auth-close-btn" onClick={onCancel}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="mobile-auth-body">
          <form onSubmit={submit} className="mobile-auth-form">

            <label className="mobile-auth-input-wrap">
              <span className="mobile-auth-label">Phone number</span>
              <div className="mobile-auth-phone-input">
                <span className="mobile-auth-phone-prefix">+234</span>
                <input
                  className="mobile-auth-input"
                  placeholder="812 345 6789"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  inputMode="numeric"
                  autoFocus
                  maxLength={11}
                  autoComplete="tel"
                />
              </div>
            </label>

            <label className="mobile-auth-input-wrap">
              <span className="mobile-auth-label">PIN (6 digits)</span>
              <input
                className="mobile-auth-input"
                placeholder="••••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                type="password"
                inputMode="numeric"
                maxLength={6}
                autoComplete="current-password"
              />
            </label>

            {error && <div className="mobile-auth-error">⚠️ {error}</div>}

            <div className="mobile-auth-button-row">
              <button className="mobile-auth-button primary" type="submit" disabled={loading}>
                {loading ? 'Signing in…' : 'Login'}
              </button>
            </div>

            <p className="mobile-auth-note">Too many failed attempts can temporarily lock your account.</p>
          </form>
        </div>
      </div>
    </div>
  );
}
