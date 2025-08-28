// src/lib/secureStore.ts
import SecureStorage from 'secure-web-storage'
import CryptoJS from 'crypto-js'

const SECRET = import.meta.env.VITE_SECURE_STORAGE_SECRET || 'dev-insecure-key'

const secureStorage = new SecureStorage(localStorage, {
  hash: (key: string) => CryptoJS.SHA256(key + SECRET).toString(),
  encrypt: (data: string) => CryptoJS.AES.encrypt(data, SECRET).toString(),
  decrypt: (data: string) => {
    const bytes = CryptoJS.AES.decrypt(data, SECRET)
    return bytes.toString(CryptoJS.enc.Utf8)
  },
})

export const tokenStore = {
  setTokens(access: string, refresh: string) {
    secureStorage.setItem('bramp_access', access)
    secureStorage.setItem('bramp_refresh', refresh)
  },
  getTokens() {
    try {
      const access = secureStorage.getItem('bramp_access') as string | null
      const refresh = secureStorage.getItem('bramp_refresh') as string | null
      return { access, refresh }
    } catch { return { access: null, refresh: null } }
  },
  setUser(user: unknown) {
    secureStorage.setItem('bramp_user', JSON.stringify(user))
  },
  getUser<T = any>(): T | null {
    try {
      const raw = secureStorage.getItem('bramp_user') as string | null
      return raw ? JSON.parse(raw) as T : null
    } catch { return null }
  },
  clear() {
    try {
      secureStorage.removeItem('bramp_access')
      secureStorage.removeItem('bramp_refresh')
      secureStorage.removeItem('bramp_user')
    } catch {}
  },
}
