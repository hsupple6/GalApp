# Auth0 Token Management System

This system allows you to manage multiple Auth0 user accounts and their tokens within your Electron app. Users can add new accounts, switch between them, and access tokens for API calls.

## Features

- **Multiple User Support**: Save and manage multiple Auth0 accounts
- **Token Management**: Store and retrieve tokens for each user
- **User Switching**: Switch between saved accounts seamlessly
- **Token Access**: Get tokens for API calls by matching user IDs
- **Debug Tools**: Built-in debugging for token inspection

## How It Works

### 1. Token Storage Structure

The system stores tokens in `localStorage` with the following structure:

```javascript
{
  "userTokens": {
    "auth0|user1": {
      "token": "jwt_token_here",
      "timestamp": 1234567890,
      "userInfo": {
        "email": "user1@example.com",
        "name": "User One",
        "picture": "https://..."
      }
    },
    "auth0|user2": {
      // ... similar structure
    }
  },
  "authToken": "current_active_token",
  "activeUserId": "auth0|user1"
}
```

### 2. Adding New Users

When you click "Add User":
1. Opens Auth0 login popup
2. User authenticates with Auth0
3. Authorization code is exchanged for access token
4. Token and user info are saved to localStorage
5. User becomes the active user

### 3. Switching Between Users

- Click "Switch" on any saved user
- The system updates the active token
- All subsequent API calls use the new token

### 4. Accessing Tokens

```javascript
// Get current active token
const token = localStorage.getItem('authToken');

// Get token for specific user
import { getTokenForUser } from './tokenUtils';
const userToken = getTokenForUser('auth0|user1');

// Make authenticated API call
fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## Components

### AppConnections.js
Main component that provides the UI for:
- Adding new users
- Switching between users
- Managing saved accounts
- Copying tokens
- Debugging

### tokenUtils.js
Utility functions for:
- Token management
- User switching
- API authentication
- Debug tools

## Usage Examples

### Basic Token Access
```javascript
import { getActiveToken, getTokenForUser } from './tokenUtils';

// Get current active token
const activeToken = getActiveToken();

// Get token for specific user
const userToken = getTokenForUser('auth0|user1');
```

### Making Authenticated API Calls
```javascript
import { makeAuthenticatedRequest } from './tokenUtils';

// Simple authenticated request
const userData = await makeAuthenticatedRequest('/api/user/profile');

// Custom request with options
const response = await makeAuthenticatedRequest('/api/data', {
  method: 'POST',
  body: JSON.stringify({ key: 'value' })
});
```

### User Management
```javascript
import { 
  getAllUsers, 
  getActiveUser, 
  switchUser, 
  removeUser 
} from './tokenUtils';

// Get all saved users
const users = getAllUsers();

// Get current active user
const activeUser = getActiveUser();

// Switch to different user
const success = switchUser('auth0|user2');

// Remove a user
const removed = removeUser('auth0|user1');
```

### Debug Tools
```javascript
import { debugTokens } from './tokenUtils';

// Log all token information to console
debugTokens();
```

## Configuration

The Auth0 configuration is in `tokenUtils.js`:

```javascript
export const AUTH0_CONFIG = {
  domain: 'dev-0j52wd0nucdjxvp3.us.auth0.com',
  clientId: 'p1cwhnJ07pD6JiHo4d1XJOiM7uCQv4Lr',
  audience: 'https://gal_001_os.bedrock.computer',
  redirectUri: window.location.origin
};
```

## Security Considerations

- Tokens are stored in localStorage (client-side only)
- No server-side storage of multiple tokens
- Tokens expire according to Auth0 settings
- Users can manually remove tokens
- Clearing browser data removes all saved accounts

## Troubleshooting

### Common Issues

1. **Token not saving**: Check Auth0 configuration and user object
2. **Switch not working**: Verify token exists in userTokens
3. **API calls failing**: Ensure token is not expired
4. **Popup blocked**: Allow popups for Auth0 domain

### Debug Commands

```javascript
// Check saved users
console.log(JSON.parse(localStorage.getItem('userTokens') || '{}'));

// Check active user
console.log(localStorage.getItem('activeUserId'));

// Check active token
console.log(localStorage.getItem('authToken'));

// Clear all users
localStorage.removeItem('userTokens');
localStorage.removeItem('authToken');
localStorage.removeItem('activeUserId');
```

### Debug Panel

Use the "🐛 Debug" button in the AppConnections component to log detailed token information to the console.

## Integration with Existing Apps

To integrate this system with your existing app:

1. Import the utility functions:
```javascript
import { getActiveToken, makeAuthenticatedRequest } from './components/src/tokenUtils';
```

2. Replace direct token access:
```javascript
// Instead of:
const token = localStorage.getItem('authToken');

// Use:
import { getActiveToken } from './tokenUtils';
const token = getActiveToken();
```

3. Use authenticated requests:
```javascript
// Instead of manual fetch with token:
fetch('/api/endpoint', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Use:
import { makeAuthenticatedRequest } from './tokenUtils';
const data = await makeAuthenticatedRequest('/api/endpoint');
```

## Future Enhancements

- Server-side token storage for cross-device sync
- Token refresh management
- Account linking/sharing
- User preferences per account
- Automatic token cleanup for expired tokens
- Token encryption for enhanced security 