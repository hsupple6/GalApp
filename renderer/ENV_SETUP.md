# Environment Variables Setup for GalApp

This document explains how to configure GalApp using environment variables.

## Quick Setup

1. Copy the example environment file:
   ```bash
   cp env.example .env
   ```

2. Edit the `.env` file with your specific values:
   ```bash
   nano .env
   ```

## Environment Variables

### GalBox Configuration

- `REACT_APP_GALBOX_IP`: The default IP address of your GalBox device
  - Default: `192.168.1.69`
  - Example: `REACT_APP_GALBOX_IP=192.168.1.100`

- `REACT_APP_GALBOX_IP_BASE`: The network base for IP scanning
  - Default: `192.168.1`
  - Example: `REACT_APP_GALBOX_IP_BASE=10.0.0` (for 10.0.0.x networks)

- `REACT_APP_GALBOX_PORT`: The port number for GalBox communication
  - Default: `5000`
  - Example: `REACT_APP_GALBOX_PORT=8080`

- `REACT_APP_DEFAULT_GATEWAY`: The default gateway for network operations
  - Default: `192.168.1.1`
  - Example: `REACT_APP_DEFAULT_GATEWAY=10.0.0.1`

### Development Configuration

- `REACT_APP_DEV_MODE`: Enable development mode
  - Default: `true`
  - Values: `true` or `false`

- `REACT_APP_DEBUG_LEVEL`: Set debug logging level
  - Default: `info`
  - Values: `debug`, `info`, `warn`, `error`

## Example .env File

```env
# GalBox Configuration
REACT_APP_GALBOX_IP=192.168.1.69
REACT_APP_GALBOX_IP_BASE=192.168.1
REACT_APP_GALBOX_PORT=5000
REACT_APP_DEFAULT_GATEWAY=192.168.1.1

# Development Configuration
REACT_APP_DEV_MODE=true
REACT_APP_DEBUG_LEVEL=info
```

## Usage in Code

### React Components
```javascript
import config, { getGalBoxUrl, logConfig } from '../config';

// Use configuration values
const galboxUrl = getGalBoxUrl();
console.log('GalBox URL:', galboxUrl);

// Log current configuration
logConfig();
```

### Main Process (Electron)
The main process automatically loads environment variables from the renderer's `.env` file.

## Network Configuration Examples

### Home Network (192.168.1.x)
```env
REACT_APP_GALBOX_IP=192.168.1.69
REACT_APP_GALBOX_IP_BASE=192.168.1
REACT_APP_DEFAULT_GATEWAY=192.168.1.1
```

### Office Network (10.0.0.x)
```env
REACT_APP_GALBOX_IP=10.0.0.100
REACT_APP_GALBOX_IP_BASE=10.0.0
REACT_APP_DEFAULT_GATEWAY=10.0.0.1
```

### Custom Network (172.16.0.x)
```env
REACT_APP_GALBOX_IP=172.16.0.50
REACT_APP_GALBOX_IP_BASE=172.16.0
REACT_APP_DEFAULT_GATEWAY=172.16.0.1
```

## Troubleshooting

1. **Environment variables not loading**: Make sure the `.env` file is in the `renderer/` directory
2. **IP scanning not working**: Check that `REACT_APP_GALBOX_IP_BASE` matches your network
3. **Connection timeouts**: Verify `REACT_APP_GALBOX_PORT` matches your GalBox server port

## Security Notes

- Never commit `.env` files to version control
- The `.env` file is already in `.gitignore`
- Use different configurations for development and production 