// Configuration file for GalApp
// This file centralizes all environment variables and provides fallbacks

const config = {
  // GalBox Configuration
  GALBOX_IP: process.env.REACT_APP_GALBOX_IP || '192.168.1.69',
  GALBOX_IP_BASE: process.env.REACT_APP_GALBOX_IP_BASE || '192.168.1',
  GALBOX_PORT: process.env.REACT_APP_GALBOX_PORT || '5000',
  DEFAULT_GATEWAY: process.env.REACT_APP_DEFAULT_GATEWAY || '192.168.1.1',
  
  // Development Configuration
  DEV_MODE: process.env.REACT_APP_DEV_MODE === 'true',
  DEBUG_LEVEL: process.env.REACT_APP_DEBUG_LEVEL || 'info',
  
  // Connection Configuration
  CONNECTION_TIMEOUT: 10000, // 10 seconds
  IP_SCAN_TIMEOUT: 2000, // 2 seconds per IP
  MAX_SCAN_ATTEMPTS: 10,
  
  // API Endpoints
  STATUS_ENDPOINT: '/status',
  CONNECT_ENDPOINT: '/',
};

// Helper function to get full GalBox URL
export const getGalBoxUrl = (ip = null, port = null) => {
  const targetIP = ip || config.GALBOX_IP;
  const targetPort = port || config.GALBOX_PORT;
  return `http://${targetIP}:${targetPort}`;
};

// Helper function to get status URL
export const getStatusUrl = (ip = null, port = null) => {
  return `${getGalBoxUrl(ip, port)}${config.STATUS_ENDPOINT}`;
};

// Helper function to get connection URL
export const getConnectionUrl = (ip = null, port = null) => {
  return `${getGalBoxUrl(ip, port)}${config.CONNECT_ENDPOINT}`;
};

// Debug function to log current configuration
export const logConfig = () => {
  console.log('GalApp Configuration:', {
    GALBOX_IP: config.GALBOX_IP,
    GALBOX_IP_BASE: config.GALBOX_IP_BASE,
    GALBOX_PORT: config.GALBOX_PORT,
    DEFAULT_GATEWAY: config.DEFAULT_GATEWAY,
    DEV_MODE: config.DEV_MODE,
    DEBUG_LEVEL: config.DEBUG_LEVEL,
  });
};

export default config; 