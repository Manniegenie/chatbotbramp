# Token Management System

This directory contains the enhanced token management system that automatically logs users out after 45 minutes to prevent 403 errors.

## Files

### `tokenManager.ts`
The main token management module that provides:
- Automatic logout after 45 minutes
- Token expiry detection
- Graceful 403/401 error handling
- Background auto-logout timer
- Auth state management

### `tokenManager.test.ts`
Test utilities for verifying token management functionality.

### `secureStore.ts`
Encrypted token storage using AES encryption.

## Features

### 🚪 Automatic Logout
- Automatically logs users out after 45 minutes (before 1-hour token expiry)
- Checks for session timeout every minute
- Provides user-friendly logout messages

### ⏰ Proactive Session Management
- Monitors token creation time (iat - issued at)
- Calculates time until auto-logout
- Maintains secure session boundaries

### 🛡️ Error Handling
- Gracefully handles 401/403 errors
- Automatically clears tokens on auth failures
- Provides clear feedback to users

### 🔐 Secure Storage
- Tokens are encrypted using AES-256
- Secure storage prevents token theft from localStorage
- Automatic cleanup on logout

## Usage

### Basic Usage
```typescript
import { authFetch, getAuthState, setupAutoLogoutTimer } from './lib/tokenManager'

// Use authFetch instead of regular fetch
const response = await authFetch('/api/protected-endpoint', {
  method: 'POST',
  body: JSON.stringify(data)
})

// Get current authentication state
const authState = getAuthState()
console.log('Is authenticated:', authState.isAuthenticated)
console.log('Time until logout:', authState.timeUntilLogout)

// Setup automatic logout timer
const cleanup = setupAutoLogoutTimer((reason) => {
  console.log('Auto-logout triggered:', reason)
})
```

### Token State Management
```typescript
import { getAuthState, clearAuth } from './lib/tokenManager'

// Check if user is authenticated
const { isAuthenticated, isTokenExpired, timeUntilLogout } = getAuthState()

// Clear authentication (logout)
clearAuth()
```

### Auto-Logout Detection
```typescript
import { shouldAutoLogout, getTimeUntilAutoLogout } from './lib/tokenManager'

// Check if user should be logged out
const { access } = tokenStore.getTokens()
if (access) {
  const shouldLogout = shouldAutoLogout(access)
  const timeLeft = getTimeUntilAutoLogout(access)
  
  console.log('Should logout:', shouldLogout)
  console.log('Time remaining:', timeLeft, 'ms')
}
```

## Configuration

### Environment Variables
```env
VITE_API_BASE=http://localhost:4000
VITE_SECURE_STORAGE_SECRET=your-secret-key
```

### Auto-Logout Settings
- **Auto-logout time**: 45 minutes after token creation
- **Check interval**: Every 60 seconds
- **Token expiry**: 1 hour (handled by backend)

## Testing

Run the test suite in the browser console:
```javascript
// Import test functions (available in development)
window.testTokenManager.runAllTests()
```

Or run individual test suites:
```javascript
window.testTokenManager.testTokenExpiry()
window.testTokenManager.testAutoLogout()
window.testTokenManager.testAuthState()
window.testTokenManager.testAutoLogoutSim()
```

## Integration

### App.tsx Integration
The main App component automatically:
- Sets up auto-logout timer on mount
- Uses `authFetch` for all API calls
- Shows logout messages when session expires
- Clears auth state on logout

### MobileApp.tsx Integration
The mobile app component has the same integration as the main app.

## Error Scenarios

### Session Timeout
1. User session reaches 45 minutes
2. System automatically logs out user
3. User sees session timeout message
4. User must sign in again

### Token Expiry
1. Token expires (after 1 hour)
2. System detects expired token
3. User is logged out automatically
4. User sees token expiry message

### Network Issues
1. API request fails with 403
2. System checks token validity
3. If token is expired/invalid, user is logged out
4. User can retry after signing in again

### Invalid Tokens
1. Tokens are corrupted or invalid
2. System detects invalid tokens
3. Auth state is cleared
4. User must sign in again

## Security Considerations

- Tokens are encrypted in localStorage
- Session timeout prevents long-lived sessions
- Failed auth attempts clear all tokens
- No tokens are logged or exposed in console
- Automatic cleanup on page unload

## Performance

- Token checks run every 60 seconds (minimal impact)
- Auto-logout checks are lightweight
- No API calls for token refresh
- Background checks don't block user interactions

## Troubleshooting

### Common Issues

1. **Users getting logged out too early**
   - Check token creation time (iat field)
   - Verify 45-minute timeout calculation
   - Check system clock accuracy

2. **403 errors still occurring**
   - Ensure `authFetch` is used instead of `fetch`
   - Verify token expiry detection is working
   - Check if tokens are being cleared properly

3. **Users not getting logged out**
   - Check auto-logout timer is running
   - Verify token validation logic
   - Check for JavaScript errors in console

### Debug Mode
Enable debug logging by setting:
```javascript
localStorage.setItem('debug_token_manager', 'true')
```

This will log auto-logout attempts and auth state changes to the console.
