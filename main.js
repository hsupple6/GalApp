const { app, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');

function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  win.loadFile('index.html');

  autoUpdater.on('update-available', () => {
    win.webContents.send('message', 'Update available. Downloading...');
  });
  autoUpdater.on('update-downloaded', () => {
    win.webContents.send('message', 'Update downloaded. It will be installed on restart.');
  });
}

app.whenReady().then(() => {
  createWindow();
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