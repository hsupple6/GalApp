// Token management utilities for Auth0 integration

// Auth0 configuration
export const AUTH0_CONFIG = {
  domain: 'dev-0j52wd0nucdjxvp3.us.auth0.com',
  clientId: 'p1cwhnJ07pD6JiHo4d1XJOiM7uCQv4Lr',
  audience: 'https://gal_001_os.bedrock.computer',
  redirectUri: window.location.origin
};

// Get current active token
export const getActiveToken = () => {
  return localStorage.getItem('authToken');
};

// Get token for specific user
export const getTokenForUser = (userId) => {
  try {
    const userTokens = JSON.parse(localStorage.getItem('userTokens') || '{}');
    return userTokens[userId]?.token || null;
  } catch (error) {
    console.error('Error getting token for user:', error);
    return null;
  }
};

// Get current active user ID
export const getActiveUserId = () => {
  return localStorage.getItem('activeUserId');
};

// Get all saved users
export const getAllUsers = () => {
  try {
    const userTokens = JSON.parse(localStorage.getItem('userTokens') || '{}');
    return Object.keys(userTokens).map(userId => ({
      id: userId,
      ...userTokens[userId].userInfo,
      timestamp: userTokens[userId].timestamp
    }));
  } catch (error) {
    console.error('Error getting all users:', error);
    return [];
  }
};

// Get active user info
export const getActiveUser = () => {
  const activeUserId = getActiveUserId();
  if (!activeUserId) return null;

  try {
    const userTokens = JSON.parse(localStorage.getItem('userTokens') || '{}');
    const userData = userTokens[activeUserId];
    if (userData) {
      return {
        id: activeUserId,
        ...userData.userInfo,
        token: userData.token
      };
    }
  } catch (error) {
    console.error('Error getting active user:', error);
  }
  return null;
};

// Switch to a different user
export const switchUser = (userId) => {
  try {
    const userTokens = JSON.parse(localStorage.getItem('userTokens') || '{}');
    const userToken = userTokens[userId];
    
    if (userToken) {
      localStorage.setItem('authToken', userToken.token);
      localStorage.setItem('activeUserId', userId);
      console.log('Switched to user:', userId);
      return true;
    }
  } catch (error) {
    console.error('Error switching user:', error);
  }
  return false;
};

// Remove a user
export const removeUser = (userId) => {
  try {
    const userTokens = JSON.parse(localStorage.getItem('userTokens') || '{}');
    delete userTokens[userId];
    localStorage.setItem('userTokens', JSON.stringify(userTokens));
    
    // If removing active user, clear active token
    const activeUserId = getActiveUserId();
    if (activeUserId === userId) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('activeUserId');
    }
    
    console.log('Removed user:', userId);
    return true;
  } catch (error) {
    console.error('Error removing user:', error);
    return false;
  }
};

// Save a new user token
export const saveUserToken = (userId, token, userInfo) => {
  try {
    const userTokens = JSON.parse(localStorage.getItem('userTokens') || '{}');
    
    userTokens[userId] = {
      token: token,
      timestamp: Date.now(),
      userInfo: {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture
      }
    };

    localStorage.setItem('userTokens', JSON.stringify(userTokens));
    
    // Set as active user
    localStorage.setItem('authToken', token);
    localStorage.setItem('activeUserId', userId);
    
    console.log('Saved token for user:', userId);
    return true;
  } catch (error) {
    console.error('Error saving user token:', error);
    return false;
  }
};

// Parse JWT token to get user info
export const parseToken = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      exp: payload.exp
    };
  } catch (error) {
    console.error('Error parsing token:', error);
    throw error;
  }
};

// Check if token is expired
export const isTokenExpired = (token) => {
  try {
    const payload = parseToken(token);
    const currentTime = Date.now() / 1000;
    return payload.exp < currentTime;
  } catch (error) {
    console.error('Error checking token expiry:', error);
    return true; // Assume expired if we can't parse
  }
};

// Create Auth0 login URL
export const createAuth0LoginUrl = (returnTo = window.location.pathname) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: AUTH0_CONFIG.clientId,
    redirect_uri: AUTH0_CONFIG.redirectUri,
    scope: 'openid profile email offline_access',
    audience: AUTH0_CONFIG.audience,
    state: JSON.stringify({ 
      returnTo: returnTo,
      timestamp: Date.now()
    })
  });

  return `https://${AUTH0_CONFIG.domain}/authorize?${params.toString()}`;
};

// Exchange authorization code for token
export const exchangeCodeForToken = async (code) => {
  try {
    const response = await fetch(`https://${AUTH0_CONFIG.domain}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: AUTH0_CONFIG.clientId,
        code: code,
        redirect_uri: AUTH0_CONFIG.redirectUri,
        audience: AUTH0_CONFIG.audience
      })
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    return await response.json();
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    throw error;
  }
};

// Make authenticated API request
export const makeAuthenticatedRequest = async (url, options = {}) => {
  const token = getActiveToken();
  
  if (!token) {
    throw new Error('No active token found');
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

// Check if user is authenticated
export const isAuthenticated = () => {
  const token = getActiveToken();
  if (!token) return false;
  
  return !isTokenExpired(token);
};

// Clear all authentication data
export const clearAllAuth = () => {
  localStorage.removeItem('userTokens');
  localStorage.removeItem('authToken');
  localStorage.removeItem('activeUserId');
  console.log('Cleared all authentication data');
};

// Get user usage data (example API call)
export const getUserUsage = async () => {
  try {
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001';
    return await makeAuthenticatedRequest(`${API_BASE_URL}/api/user/usage`);
  } catch (error) {
    console.error('Error fetching user usage:', error);
    throw error;
  }
};

// Debug function to log all stored tokens
export const debugTokens = () => {
  console.group('🔍 Token Debug Info');
  
  const activeToken = getActiveToken();
  const activeUserId = getActiveUserId();
  const allUsers = getAllUsers();
  const userTokens = JSON.parse(localStorage.getItem('userTokens') || '{}');
  
  console.log('Active Token:', activeToken ? 'Present' : 'None');
  console.log('Active User ID:', activeUserId);
  console.log('All Users:', allUsers);
  console.log('User Tokens:', userTokens);
  
  if (activeToken) {
    try {
      const parsed = parseToken(activeToken);
      console.log('Token Info:', parsed);
      console.log('Token Expired:', isTokenExpired(activeToken));
    } catch (error) {
      console.error('Error parsing active token:', error);
    }
  }
  
  console.groupEnd();
}; 