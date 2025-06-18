// API configuration
const getOriginUrl = () => {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isLocalhost ? process.env.REACT_APP_BACKEND_ENDPOINT : window.location.origin;
};

const getWebsocketUrl = () => {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  
  // For production, use the websocket-server LoadBalancer URL from environment variable
  // Add fallback to prevent undefined hostname
  const host = process.env.REACT_APP_GALBOX_IP || 
    (isLocalhost ? 'localhost' : window.location.hostname);
  
  // Always use port 1234
  const port = '1234';
  
  return `${protocol}//${host}:${port}`;
};

export const API_ORIGIN_URL = getOriginUrl();
export const API_BASE_URL = `${API_ORIGIN_URL}/api`;
export const WEBSOCKET_URL = getWebsocketUrl();
