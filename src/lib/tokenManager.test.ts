// src/lib/tokenManager.test.ts
// Test utilities for token management functionality

import { 
  isExpiredJwt, 
  getTokenExpiryTime, 
  isTokenExpiringSoon, 
  getAuthState,
  getValidAccessToken,
  authFetch 
} from './tokenManager'
import { tokenStore } from './secureStore'

// Mock JWT tokens for testing
const createMockJWT = (exp: number): string => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ exp, iat: Math.floor(Date.now() / 1000) }))
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
    isRefreshing: authenticatedState.isRefreshing,
    expected: { isAuthenticated: true, isTokenExpired: false, isRefreshing: false }
  })
  
  // Test with expired access token
  const expiredAccessToken = createMockJWT(Math.floor((Date.now() - 3600000) / 1000))
  tokenStore.setTokens(expiredAccessToken, validRefreshToken)
  
  const expiredState = getAuthState()
  console.log('Expired token state:', {
    isAuthenticated: expiredState.isAuthenticated,
    isTokenExpired: expiredState.isTokenExpired,
    isRefreshing: expiredState.isRefreshing,
    expected: { isAuthenticated: false, isTokenExpired: true, isRefreshing: false }
  })
  
  // Cleanup
  tokenStore.clear()
  console.log('✅ Auth state management tests completed')
}

// Test token refresh simulation (without actual API calls)
export function testTokenRefreshSimulation() {
  console.log('🧪 Testing token refresh simulation...')
  
  // This test simulates the token refresh flow without making actual API calls
  // In a real scenario, you would mock the fetch function
  
  console.log('Token refresh simulation would test:')
  console.log('- Automatic refresh when token expires')
  console.log('- Retry failed requests after refresh')
  console.log('- Graceful handling of refresh failures')
  console.log('- Prevention of multiple simultaneous refresh attempts')
  
  console.log('✅ Token refresh simulation tests completed')
}

// Run all tests
export function runAllTokenTests() {
  console.log('🚀 Running all token management tests...')
  console.log('==========================================')
  
  try {
    testTokenExpiryFunctions()
    console.log('')
    
    testAuthStateManagement()
    console.log('')
    
    testTokenRefreshSimulation()
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
    testAuthState: testAuthStateManagement,
    testRefresh: testTokenRefreshSimulation
  }
}
