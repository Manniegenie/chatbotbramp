// src/lib/tokenManager.ts
// Enhanced token management with automatic refresh and expiry handling

import { tokenStore } from './secureStore'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'

// Token refresh state to prevent multiple simultaneous refresh attempts
let refreshPromise: Promise<{ access: string; refresh: string } | null> | null = null

export interface TokenRefreshResult {
  access: string
  refresh: string
  user?: any
}

export interface AuthState {
  isAuthenticated: boolean
  isTokenExpired: boolean
  isRefreshing: boolean
  lastRefreshAttempt?: number
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
 * Check if token will expire soon (within next 5 minutes)
 */
export function isTokenExpiringSoon(token: string, thresholdMs = 5 * 60 * 1000): boolean {
  const timeUntilExpiry = getTokenExpiryTime(token)
  return timeUntilExpiry > 0 && timeUntilExpiry <= thresholdMs
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(): Promise<TokenRefreshResult | null> {
  const { refresh } = tokenStore.getTokens()
  
  if (!refresh || isExpiredJwt(refresh)) {
    console.warn('No valid refresh token available')
    return null
  }

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refresh}`
      },
      body: JSON.stringify({ refreshToken: refresh })
    })

    if (!response.ok) {
      console.error('Token refresh failed:', response.status, response.statusText)
      return null
    }

    const data = await response.json()
    
    if (!data.accessToken) {
      console.error('No access token in refresh response')
      return null
    }

    // Store new tokens
    await tokenStore.setTokens(data.accessToken, data.refreshToken || refresh)
    
    // Update user data if provided
    if (data.user) {
      tokenStore.setUser(data.user)
    }

    return {
      access: data.accessToken,
      refresh: data.refreshToken || refresh,
      user: data.user
    }
  } catch (error) {
    console.error('Token refresh error:', error)
    return null
  }
}

/**
 * Get valid access token, refreshing if necessary
 */
export async function getValidAccessToken(): Promise<string | null> {
  const { access, refresh } = tokenStore.getTokens()
  
  // If no access token, return null
  if (!access) {
    return null
  }

  // If access token is still valid, return it
  if (!isExpiredJwt(access)) {
    // Check if it's expiring soon and refresh proactively
    if (isTokenExpiringSoon(access)) {
      // Refresh in background without waiting
      refreshAccessToken().catch(console.error)
    }
    return access
  }

  // Access token is expired, try to refresh
  if (!refresh || isExpiredJwt(refresh)) {
    console.warn('Access token expired and no valid refresh token')
    return null
  }

  // Use existing refresh promise if one is in progress
  if (refreshPromise) {
    const result = await refreshPromise
    return result?.access || null
  }

  // Start new refresh
  refreshPromise = refreshAccessToken()
  
  try {
    const result = await refreshPromise
    return result?.access || null
  } finally {
    refreshPromise = null
  }
}

/**
 * Enhanced auth fetch that handles token refresh automatically
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const accessToken = await getValidAccessToken()
  
  const headers = new Headers(init.headers || {})
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(input, { ...init, headers })

  // If we get a 401/403, try refreshing the token once
  if ((response.status === 401 || response.status === 403) && accessToken) {
    console.warn('Received auth error, attempting token refresh')
    
    // Try to refresh token
    const refreshResult = await refreshAccessToken()
    
    if (refreshResult?.access) {
      // Retry the request with new token
      headers.set('Authorization', `Bearer ${refreshResult.access}`)
      return fetch(input, { ...init, headers })
    } else {
      // Refresh failed, clear tokens and return original response
      tokenStore.clear()
      console.error('Token refresh failed, clearing auth state')
    }
  }

  return response
}

/**
 * Get current authentication state
 */
export function getAuthState(): AuthState {
  const { access, refresh } = tokenStore.getTokens()
  const user = tokenStore.getUser()
  
  return {
    isAuthenticated: Boolean(access && refresh && user && !isExpiredJwt(access)),
    isTokenExpired: Boolean(access && isExpiredJwt(access)),
    isRefreshing: Boolean(refreshPromise),
    lastRefreshAttempt: refreshPromise ? Date.now() : undefined
  }
}

/**
 * Clear authentication state
 */
export function clearAuth(): void {
  tokenStore.clear()
  refreshPromise = null
}

/**
 * Set up automatic token refresh timer
 */
export function setupTokenRefreshTimer(callback?: (newTokens: TokenRefreshResult) => void): () => void {
  const checkInterval = 60000 // Check every minute
  
  const intervalId = setInterval(async () => {
    const { access } = tokenStore.getTokens()
    
    if (access && isTokenExpiringSoon(access)) {
      console.log('Token expiring soon, refreshing...')
      const result = await refreshAccessToken()
      
      if (result && callback) {
        callback(result)
      }
    }
  }, checkInterval)

  // Return cleanup function
  return () => {
    clearInterval(intervalId)
  }
}

/**
 * Force token refresh (useful for manual refresh)
 */
export async function forceTokenRefresh(): Promise<TokenRefreshResult | null> {
  refreshPromise = null // Clear any existing promise
  return await refreshAccessToken()
}
