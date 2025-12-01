// src/lib/secureStore.ts
const SECRET = import.meta.env.VITE_SECURE_STORAGE_SECRET || 'dev-fallback-key'

class TokenStore {
  private tokens: { access: string | null; refresh: string | null } = {
    access: null,
    refresh: null,
  }
  private user: any = null
  private initPromise: Promise<void>
  private cryptoKey: CryptoKey | null = null

  constructor() {
    this.initPromise = this.initialize()
  }

  private async initialize(): Promise<void> {
    try {
      const encoder = new TextEncoder()
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(SECRET),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      )

      this.cryptoKey = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: encoder.encode('bramp-salt-v1'),
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      )

      await this.loadFromStorage()
    } catch (err) {
      console.error('Failed to initialize secure storage:', err)
    }
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const [access, refresh, user] = await Promise.all([
        this.getStorageItem('bramp_access_enc'),
        this.getStorageItem('bramp_refresh_enc'),
        this.getStorageItem('bramp_user_enc'),
      ])

      this.tokens.access = access
      this.tokens.refresh = refresh
      
      if (user) {
        try {
          this.user = JSON.parse(user)
        } catch {
          this.user = null
        }
      }
    } catch (err) {
      console.error('Failed to load from storage:', err)
    }
  }

  private async encrypt(data: string): Promise<string> {
    if (!this.cryptoKey) throw new Error('Crypto key not initialized')
    const encoder = new TextEncoder()
    const iv = window.crypto.getRandomValues(new Uint8Array(12))
    
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.cryptoKey,
      encoder.encode(data)
    )

    const combined = new Uint8Array(iv.length + encrypted.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(encrypted), iv.length)
    
    // Use a robust binary-to-base64 conversion
    return window.btoa(String.fromCharCode(...combined))
  }

  private async decrypt(data: string): Promise<string> {
    if (!this.cryptoKey) throw new Error('Crypto key not initialized')
    try {
      const combined = Uint8Array.from(atob(data), c => c.charCodeAt(0))
      const iv = combined.slice(0, 12)
      const encrypted = combined.slice(12)

      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.cryptoKey,
        encrypted
      )
      return new TextDecoder().decode(decrypted)
    } catch (err) {
      console.error('Decryption failed:', err)
      return ''
    }
  }

  private async setStorageItem(key: string, value: string): Promise<void> {
    try {
      const encrypted = await this.encrypt(value)
      localStorage.setItem(key, encrypted)
    } catch (err) {
      console.error(`Failed to save ${key}:`, err)
    }
  }

  private async getStorageItem(key: string): Promise<string | null> {
    try {
      const encrypted = localStorage.getItem(key)
      if (!encrypted) return null
      return await this.decrypt(encrypted)
    } catch (err) {
      return null
    }
  }

  // --- PUBLIC API ---

  async setTokens(access: string, refresh: string): Promise<void> {
    await this.initPromise
    this.tokens.access = access
    this.tokens.refresh = refresh
    await Promise.all([
      this.setStorageItem('bramp_access_enc', access),
      this.setStorageItem('bramp_refresh_enc', refresh),
    ])
  }

  // UPDATED: Now Async to prevent race conditions on app load
  async getTokens(): Promise<{ access: string | null; refresh: string | null }> {
    await this.initPromise
    return { ...this.tokens }
  }

  async setUser(user: unknown): Promise<void> {
    await this.initPromise
    this.user = user
    await this.setStorageItem('bramp_user_enc', JSON.stringify(user))
  }

  getUser<T = any>(): T | null {
    return this.user as T | null
  }

  async clear(): Promise<void> {
    await this.initPromise
    this.tokens = { access: null, refresh: null }
    this.user = null
    localStorage.removeItem('bramp_access_enc')
    localStorage.removeItem('bramp_refresh_enc')
    localStorage.removeItem('bramp_user_enc')
  }
}

export const tokenStore = new TokenStore()