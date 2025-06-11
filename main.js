const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const dgram = require('dgram');
const isDev = !app.isPackaged;
const { autoUpdater } = require('electron-updater');

let discoveredServers = [];

function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, 'renderer', 'build', 'index.html'));
  }

  // Send computer name to renderer
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('computer-name', os.hostname());
  });

  // Send discovered servers to renderer
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('discovered-servers', discoveredServers);
  });

  autoUpdater.on('update-available', () => {
    win.webContents.send('message', 'Update available. Downloading...');
  });
  autoUpdater.on('update-downloaded', () => {
    win.webContents.send('message', 'Update downloaded. It will be installed on restart.');
  });
}

// UDP Discovery Listener
function startDiscovery() {
  const socket = dgram.createSocket('udp4');
  
  socket.on('error', (err) => {
    console.log('UDP Error:', err);
  });

  socket.on('message', (msg, rinfo) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === 'discovery') {
        const serverInfo = {
          ip: data.ip,
          timestamp: data.timestamp,
          discoveredAt: Date.now()
        };
        
        // Update discovered servers list
        const existingIndex = discoveredServers.findIndex(s => s.ip === data.ip);
        if (existingIndex >= 0) {
          discoveredServers[existingIndex] = serverInfo;
        } else {
          discoveredServers.push(serverInfo);
        }
        
        // Send to renderer
        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('discovered-servers', discoveredServers);
        });
      }
    } catch (e) {
      console.log('Error parsing discovery message:', e);
    }
  });

  socket.bind(8888);
  console.log('Listening for server discovery on port 8888');
}

// IPC handler for computer name
ipcMain.handle('get-computer-name', () => {
  return os.hostname();
});

app.whenReady().then(() => {
  createWindow();
  startDiscovery();
  autoUpdater.checkForUpdatesAndNotify();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}); 