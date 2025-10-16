# Token Management System

This directory contains the enhanced token management system that prevents 403 errors by automatically handling token expiry and refresh.

## Files

### `tokenManager.ts`
The main token management module that provides:
- Automatic token refresh
- Token expiry detection
- Graceful 403/401 error handling
- Background token refresh timer
- Auth state management

### `tokenManager.test.ts`
Test utilities for verifying token management functionality.

### `secureStore.ts`
Encrypted token storage using AES encryption.

## Features

### 🔄 Automatic Token Refresh
- Automatically refreshes tokens when they expire or are about to expire
- Prevents multiple simultaneous refresh attempts
- Retries failed API calls after successful token refresh

### ⏰ Proactive Token Management
- Checks for token expiry every minute
- Refreshes tokens 5 minutes before they expire
- Maintains seamless user experience

### 🛡️ Error Handling
- Gracefully handles 401/403 errors
- Automatically attempts token refresh on auth failures
- Clears invalid tokens and redirects to login when refresh fails

### 🔐 Secure Storage
- Tokens are encrypted using AES-256
- Secure storage prevents token theft from localStorage
- Automatic cleanup on logout

## Usage

### Basic Usage
```typescript
import { authFetch, getAuthState, setupTokenRefreshTimer } from './lib/tokenManager'

// Use authFetch instead of regular fetch
const response = await authFetch('/api/protected-endpoint', {
  method: 'POST',
  body: JSON.stringify(data)
})

// Get current authentication state
const authState = getAuthState()
console.log('Is authenticated:', authState.isAuthenticated)

// Setup automatic token refresh timer
const cleanup = setupTokenRefreshTimer((newTokens) => {
  console.log('Tokens refreshed:', newTokens)
})
```

### Token State Management
```typescript
import { getAuthState, clearAuth } from './lib/tokenManager'

// Check if user is authenticated
const { isAuthenticated, isTokenExpired, isRefreshing } = getAuthState()

// Clear authentication (logout)
clearAuth()
```

### Manual Token Refresh
```typescript
import { forceTokenRefresh } from './lib/tokenManager'

// Force a token refresh
const result = await forceTokenRefresh()
if (result) {
  console.log('New tokens:', result)
}
```

## API Endpoints

The token manager expects the following API endpoints:

### Token Refresh
```
POST /auth/refresh
Authorization: Bearer <refresh_token>
Content-Type: application/json

Body: { "refreshToken": "<refresh_token>" }

Response: {
  "accessToken": "<new_access_token>",
  "refreshToken": "<new_refresh_token>",
  "user": { ... }
}
```

## Configuration

### Environment Variables
```env
VITE_API_BASE=http://localhost:4000
VITE_SECURE_STORAGE_SECRET=your-secret-key
```

### Token Refresh Settings
- **Refresh threshold**: 5 minutes before expiry
- **Check interval**: Every 60 seconds
- **Max retry attempts**: 1 retry after refresh

## Testing

Run the test suite in the browser console:
```javascript
// Import test functions (available in development)
window.testTokenManager.runAllTests()
```

Or run individual test suites:
```javascript
window.testTokenManager.testTokenExpiry()
window.testTokenManager.testAuthState()
window.testTokenManager.testRefresh()
```

## Integration

### App.tsx Integration
The main App component automatically:
- Sets up token refresh timer on mount
- Uses `authFetch` for all API calls
- Updates auth state when tokens are refreshed
- Clears auth state on logout

### MobileApp.tsx Integration
The mobile app component has the same integration as the main app.

## Error Scenarios

### Token Refresh Fails
1. User gets 403 error
2. System attempts token refresh
3. If refresh fails, tokens are cleared
4. User is redirected to login

### Network Issues
1. Token refresh request fails
2. Original request fails with 403
3. User sees error message
4. Can retry manually or refresh page

### Invalid Tokens
1. Tokens are corrupted or invalid
2. System detects invalid tokens
3. Auth state is cleared
4. User must sign in again

## Security Considerations

- Tokens are encrypted in localStorage
- Refresh tokens are validated before use
- Failed refresh attempts clear all tokens
- No tokens are logged or exposed in console
- Automatic cleanup on page unload

## Performance

- Token checks run every 60 seconds (minimal impact)
- Refresh attempts are debounced (no multiple simultaneous calls)
- Failed requests are retried only once
- Background refresh doesn't block user interactions

## Troubleshooting

### Common Issues

1. **Tokens not refreshing**
   - Check API endpoint `/auth/refresh` is working
   - Verify refresh token is valid
   - Check network connectivity

2. **403 errors still occurring**
   - Ensure `authFetch` is used instead of `fetch`
   - Check token refresh endpoint returns correct format
   - Verify token expiry detection is working

3. **User getting logged out unexpectedly**
   - Check refresh token expiry
   - Verify secure storage is working
   - Check for JavaScript errors in console

### Debug Mode
Enable debug logging by setting:
```javascript
localStorage.setItem('debug_token_manager', 'true')
```

This will log token refresh attempts and auth state changes to the console.
