/**
 * GalBox Configuration Settings
 * This file centralizes configuration for GalBox connections
 */

// SSH credentials for connecting to GalBox
export const GALBOX_SSH_CREDENTIALS = {
  // Default credentials - update these to match your GalBox setup
  username: 'ubuntu',   // Change to your actual GalBox username
  password: 'ubuntu'    // Change to your actual GalBox password
};

// Default ports for GalBox services
export const GALBOX_PORTS = {
  apiServer: 3001,      // Port for the GalBox API server
  ollama: 11434         // Port for direct Ollama connections
};

// GalBox discovery settings
export const GALBOX_DISCOVERY = {
  // Common IP patterns for finding GalBox devices on the network
  commonIpPatterns: [
    '169.254.',         // Direct Ethernet connection
    '192.168.2.',       // Common GalBox subnet
    '192.168.1.',       // Common home network subnet
    '10.0.0.',          // Another common subnet
    '172.16.'           // Another common subnet
  ],
  
  // Well-known GalBox IP addresses to try first
  knownIps: [
    '192.168.2.2',      // Ethernet
    '192.168.1.14'      // WiFi
  ]
}; 