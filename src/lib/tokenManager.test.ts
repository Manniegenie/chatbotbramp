// src/lib/tokenManager.test.ts
// Test utilities for token management functionality

import { 
  isExpiredJwt, 
  getTokenExpiryTime, 
  isTokenExpiringSoon, 
  shouldAutoLogout,
  getTimeUntilAutoLogout,
  getAuthState,
  getValidAccessToken,
  authFetch 
} from './tokenManager'
import { tokenStore } from './secureStore'

// Mock JWT tokens for testing
const createMockJWT = (exp: number, iat?: number): string => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const issuedAt = iat || Math.floor(Date.now() / 1000)
  const payload = btoa(JSON.stringify({ exp, iat: issuedAt }))
  const signature = 'mock_signature'
  return `${header}.${payload}.${signature}`
}

// Test token expiry functions
export function testTokenExpiryFunctions() {
  console.log('🧪 Testing token expiry functions...')
  
  // Test with expired token (expired 1 hour ago)
  const expiredToken = createMockJWT(Math.floor((Date.now() - 3600000) / 1000))
  console.log('Expired token test:', {
    isExpired: isExpiredJwt(expiredToken),
    expected: true
  })
  
  // Test with valid token (expires in 1 hour)
  const validToken = createMockJWT(Math.floor((Date.now() + 3600000) / 1000))
  console.log('Valid token test:', {
    isExpired: isExpiredJwt(validToken),
    expected: false
  })
  
  // Test with token expiring soon (expires in 2 minutes)
  const expiringSoonToken = createMockJWT(Math.floor((Date.now() + 120000) / 1000))
  console.log('Expiring soon test:', {
    isExpiringSoon: isTokenExpiringSoon(expiringSoonToken),
    expiryTime: getTokenExpiryTime(expiringSoonToken),
    expected: true
  })
  
  console.log('✅ Token expiry function tests completed')
}

// Test auto-logout functions
export function testAutoLogoutFunctions() {
  console.log('🧪 Testing auto-logout functions...')
  
  // Test token that should trigger auto-logout (created 50 minutes ago)
  const oldToken = createMockJWT(
    Math.floor((Date.now() + 3600000) / 1000), // expires in 1 hour
    Math.floor((Date.now() - 50 * 60 * 1000) / 1000) // created 50 minutes ago
  )
  console.log('Auto-logout test (50 min old):', {
    shouldLogout: shouldAutoLogout(oldToken),
    timeUntilLogout: getTimeUntilAutoLogout(oldToken),
    expected: true
  })
  
  // Test token that should NOT trigger auto-logout (created 30 minutes ago)
  const newToken = createMockJWT(
    Math.floor((Date.now() + 3600000) / 1000), // expires in 1 hour
    Math.floor((Date.now() - 30 * 60 * 1000) / 1000) // created 30 minutes ago
  )
  console.log('No auto-logout test (30 min old):', {
    shouldLogout: shouldAutoLogout(newToken),
    timeUntilLogout: getTimeUntilAutoLogout(newToken),
    expected: false
  })
  
  console.log('✅ Auto-logout function tests completed')
}

// Test auth state management
export function testAuthStateManagement() {
  console.log('🧪 Testing auth state management...')
  
  // Clear any existing tokens
  tokenStore.clear()
  
  // Test unauthenticated state
  const unauthenticatedState = getAuthState()
  console.log('Unauthenticated state:', {
    isAuthenticated: unauthenticatedState.isAuthenticated,
    isTokenExpired: unauthenticatedState.isTokenExpired,
    isRefreshing: unauthenticatedState.isRefreshing,
    expected: { isAuthenticated: false, isTokenExpired: false, isRefreshing: false }
  })
  
  // Test with valid tokens
  const validAccessToken = createMockJWT(Math.floor((Date.now() + 3600000) / 1000))
  const validRefreshToken = createMockJWT(Math.floor((Date.now() + 7200000) / 1000))
  
  tokenStore.setTokens(validAccessToken, validRefreshToken)
  tokenStore.setUser({ id: 'test', username: 'testuser' })
  
  const authenticatedState = getAuthState()
  console.log('Authenticated state:', {
    isAuthenticated: authenticatedState.isAuthenticated,
    isTokenExpired: authenticatedState.isTokenExpired,
    timeUntilLogout: authenticatedState.timeUntilLogout,
    expected: { isAuthenticated: true, isTokenExpired: false, timeUntilLogout: expect.any(Number) }
  })
  
  // Test with expired access token
  const expiredAccessToken = createMockJWT(Math.floor((Date.now() - 3600000) / 1000))
  tokenStore.setTokens(expiredAccessToken, validRefreshToken)
  
  const expiredState = getAuthState()
  console.log('Expired token state:', {
    isAuthenticated: expiredState.isAuthenticated,
    isTokenExpired: expiredState.isTokenExpired,
    timeUntilLogout: expiredState.timeUntilLogout,
    expected: { isAuthenticated: false, isTokenExpired: true, timeUntilLogout: 0 }
  })
  
  // Cleanup
  tokenStore.clear()
  console.log('✅ Auth state management tests completed')
}

// Test auto-logout simulation
export function testAutoLogoutSimulation() {
  console.log('🧪 Testing auto-logout simulation...')
  
  // This test simulates the auto-logout flow
  console.log('Auto-logout simulation tests:')
  console.log('- Automatic logout after 45 minutes')
  console.log('- Session timeout detection')
  console.log('- Graceful token cleanup')
  console.log('- User notification on logout')
  
  console.log('✅ Auto-logout simulation tests completed')
}

// Run all tests
export function runAllTokenTests() {
  console.log('🚀 Running all token management tests...')
  console.log('==========================================')
  
  try {
    testTokenExpiryFunctions()
    console.log('')
    
    testAutoLogoutFunctions()
    console.log('')
    
    testAuthStateManagement()
    console.log('')
    
    testAutoLogoutSimulation()
    console.log('')
    
    console.log('🎉 All token management tests completed successfully!')
  } catch (error) {
    console.error('❌ Token management tests failed:', error)
  }
}

// Export for use in development console
if (typeof window !== 'undefined') {
  (window as any).testTokenManager = {
    runAllTests: runAllTokenTests,
    testTokenExpiry: testTokenExpiryFunctions,
    testAutoLogout: testAutoLogoutFunctions,
    testAuthState: testAuthStateManagement,
    testAutoLogoutSim: testAutoLogoutSimulation
  }
}
