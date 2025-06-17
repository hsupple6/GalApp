// Utility function to update galos-gui .env file with discovered IPs
export const updateEnvFile = async (key, value) => {
  try {
    // This will be called from the main process since React can't directly write files
    if (window.electronAPI && window.electronAPI.updateEnvFile) {
      const success = await window.electronAPI.updateEnvFile(key, value);
      if (success) {
        console.log(`Successfully updated galos-gui .env file: ${key}=${value}`);
        return true;
      } else {
        console.error('Failed to update galos-gui .env file');
        return false;
      }
    } else {
      console.warn('updateEnvFile API not available in main process');
      return false;
    }
  } catch (error) {
    console.error('Error updating galos-gui .env file:', error);
    return false;
  }
};

// Function to update GalBox IP in .env
export const updateGalBoxIP = async (ip) => {
  return await updateEnvFile('REACT_APP_GALBOX_IP', ip);
};

// Function to update GalBox IP base in .env
export const updateGalBoxIPBase = async (ipBase) => {
  return await updateEnvFile('REACT_APP_GALBOX_IP_BASE', ipBase);
};

// Function to update backend endpoint using GalBox IP
export const updateBackendEndpoint = async (ip, port = '5000') => {
  const endpoint = `http://${ip}:${port}`;
  return await updateEnvFile('REACT_APP_BACKEND_ENDPOINT', endpoint);
};
