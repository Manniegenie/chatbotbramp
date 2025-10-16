// src/lib/tokenManager.ts
// Enhanced token management with automatic logout on expiry

import { tokenStore } from './secureStore'

export interface AuthState {
  isAuthenticated: boolean
  isTokenExpired: boolean
  timeUntilLogout?: number // milliseconds until auto-logout
}

export interface AutoLogoutCallback {
  (reason: 'token_expired' | 'session_timeout'): void
}

/**
 * Check if a JWT token is expired
 */
export function isExpiredJwt(token: string): boolean {
  try {
    const [, payloadB64] = token.split('.')
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    const { exp } = JSON.parse(json)
    return !exp || Date.now() >= exp * 1000
  } catch {
    return true
  }
}

/**
 * Get time until token expires in milliseconds
 */
export function getTokenExpiryTime(token: string): number {
  try {
    const [, payloadB64] = token.split('.')
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    const { exp } = JSON.parse(json)
    if (!exp) return 0
    return (exp * 1000) - Date.now()
  } catch {
    return 0
  }
}

/**
 * Check if token will expire soon (within next 15 minutes for auto-logout)
 */
export function isTokenExpiringSoon(token: string, thresholdMs = 15 * 60 * 1000): boolean {
  const timeUntilExpiry = getTokenExpiryTime(token)
  return timeUntilExpiry > 0 && timeUntilExpiry <= thresholdMs
}

/**
 * Check if user should be logged out (45 minutes after token creation)
 */
export function shouldAutoLogout(token: string): boolean {
  try {
    const [, payloadB64] = token.split('.')
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    const { iat } = JSON.parse(json) // issued at time
    
    if (!iat) return false
    
    const tokenCreatedAt = iat * 1000 // convert to milliseconds
    const currentTime = Date.now()
    const timeSinceCreation = currentTime - tokenCreatedAt
    const autoLogoutTime = 45 * 60 * 1000 // 45 minutes in milliseconds
    
    return timeSinceCreation >= autoLogoutTime
  } catch {
    return false
  }
}

/**
 * Get time until auto-logout (45 minutes after token creation)
 */
export function getTimeUntilAutoLogout(token: string): number {
  try {
    const [, payloadB64] = token.split('.')
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    const { iat } = JSON.parse(json)
    
    if (!iat) return 0
    
    const tokenCreatedAt = iat * 1000
    const currentTime = Date.now()
    const timeSinceCreation = currentTime - tokenCreatedAt
    const autoLogoutTime = 45 * 60 * 1000 // 45 minutes
    
    return Math.max(0, autoLogoutTime - timeSinceCreation)
  } catch {
    return 0
  }
}

/**
 * Check if user should be logged out and clear tokens if needed
 */
function checkAndHandleAutoLogout(onLogout?: AutoLogoutCallback): boolean {
  const { access } = tokenStore.getTokens()
  
  if (!access) {
    return false
  }

  // Check if token is expired or should auto-logout
  if (isExpiredJwt(access) || shouldAutoLogout(access)) {
    console.log('Token expired or session timeout reached, logging out user')
    tokenStore.clear()
    
    if (onLogout) {
      const reason = isExpiredJwt(access) ? 'token_expired' : 'session_timeout'
      onLogout(reason)
    }
    
    return true
  }
  
  return false
}

/**
 * Get valid access token, returns null if expired or should logout
 */
export function getValidAccessToken(): string | null {
  const { access } = tokenStore.getTokens()
  
  if (!access) {
    return null
  }

  // Check if token is expired or should auto-logout
  if (isExpiredJwt(access) || shouldAutoLogout(access)) {
    console.log('Token is invalid or session timeout reached')
    return null
  }

  return access
}

/**
 * Enhanced auth fetch that handles auto-logout on token expiry
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}, onLogout?: AutoLogoutCallback): Promise<Response> {
  const accessToken = getValidAccessToken()
  
  const headers = new Headers(init.headers || {})
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(input, { ...init, headers })

  // If we get a 401/403, check for auto-logout
  if ((response.status === 401 || response.status === 403) && accessToken) {
    console.warn('Received auth error, checking for auto-logout')
    checkAndHandleAutoLogout(onLogout)
  }

  return response
}

/**
 * Get current authentication state
 */
export function getAuthState(): AuthState {
  const { access } = tokenStore.getTokens()
  const user = tokenStore.getUser()
  
  const isExpired = access ? isExpiredJwt(access) : false
  const shouldLogout = access ? shouldAutoLogout(access) : false
  const timeUntilLogout = access ? getTimeUntilAutoLogout(access) : undefined
  
  return {
    isAuthenticated: Boolean(access && user && !isExpired && !shouldLogout),
    isTokenExpired: isExpired || shouldLogout,
    timeUntilLogout: timeUntilLogout
  }
}

/**
 * Clear authentication state
 */
export function clearAuth(): void {
  tokenStore.clear()
}

/**
 * Set up automatic logout timer that checks every minute
 */
export function setupAutoLogoutTimer(onLogout?: AutoLogoutCallback): () => void {
  const checkInterval = 60000 // Check every minute
  
  const intervalId = setInterval(() => {
    checkAndHandleAutoLogout(onLogout)
  }, checkInterval)

  // Return cleanup function
  return () => {
    clearInterval(intervalId)
  }
}
