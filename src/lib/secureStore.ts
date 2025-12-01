// src/lib/secureStore.ts
import SecureStorage from 'secure-web-storage'
import CryptoJS from 'crypto-js'

const SECRET = import.meta.env.VITE_SECURE_STORAGE_SECRET

if (!SECRET || SECRET === 'dev-insecure-key') {
  throw new Error('VITE_SECURE_STORAGE_SECRET must be set to a secure value in production')
}

const secureStorage = new SecureStorage(localStorage, {
  hash: (key: string) => CryptoJS.SHA256(key + SECRET).toString(),
  encrypt: (data: string) => CryptoJS.AES.encrypt(data, SECRET).toString(),
  decrypt: (data: string) => {
    const bytes = CryptoJS.AES.decrypt(data, SECRET)
    return bytes.toString(CryptoJS.enc.Utf8)
  },
})

export const tokenStore = {
  async setTokens(access: string, refresh: string) {
    // Use setTimeout to ensure the storage operations complete
    return new Promise<void>((resolve) => {
      secureStorage.setItem('bramp_access', access)
      secureStorage.setItem('bramp_refresh', refresh)
      
      // Small delay to ensure encryption and storage completion
      setTimeout(() => resolve(), 50)
    })
  },
  
  getTokens() {
    try {
      const access = secureStorage.getItem('bramp_access') as string | null
      const refresh = secureStorage.getItem('bramp_refresh') as string | null
      return { access, refresh }
    } catch { 
      return { access: null, refresh: null } 
    }
  },
  
  // Helper method to wait for tokens to be available
  async waitForTokens(maxWaitMs = 2000): Promise<{ access: string | null; refresh: string | null }> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitMs) {
      const tokens = this.getTokens()
      if (tokens.access) {
        return tokens
      }
      // Wait 50ms before checking again
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    // Return whatever we have after timeout
    return this.getTokens()
  },
  
  setUser(user: unknown) {
    secureStorage.setItem('bramp_user', JSON.stringify(user))
  },
  
  getUser<T = any>(): T | null {
    try {
      const raw = secureStorage.getItem('bramp_user') as string | null
      return raw ? JSON.parse(raw) as T : null
    } catch { 
      return null 
    }
  },
  
  clear() {
    try {
      secureStorage.removeItem('bramp_access')
      secureStorage.removeItem('bramp_refresh')
      secureStorage.removeItem('bramp_user')
    } catch {}
  },
}