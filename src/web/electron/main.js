const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let backendProcess;
const isDev = process.env.NODE_ENV === 'development';

// Get the path to the backend executable
function getBackendPath() {
  if (isDev) {
    return null; // Use external backend in dev mode
  }
  
  const platform = process.platform;
  const basePath = app.isPackaged 
    ? path.join(process.resourcesPath, 'backend')
    : path.join(__dirname, '..', '..', 'backend', 'dist');
  
  switch (platform) {
    case 'win32':
      return path.join(basePath, 'watchnexus-server.exe');
    case 'darwin':
    case 'linux':
      return path.join(basePath, 'watchnexus-server');
    default:
      console.error('Unsupported platform:', platform);
      return null;
  }
}

// Get user data directory for storing data
function getUserDataPath() {
  const dataPath = path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }
  return dataPath;
}

// Get downloads directory
function getDownloadsPath() {
  const defaultPath = path.join(app.getPath('downloads'), 'WatchNexus');
  if (!fs.existsSync(defaultPath)) {
    fs.mkdirSync(defaultPath, { recursive: true });
  }
  return defaultPath;
}

// Start the backend server
function startBackend() {
  const backendPath = getBackendPath();
  if (!backendPath) {
    console.log('Running in dev mode, backend should be started separately');
    return;
  }
  
  if (!fs.existsSync(backendPath)) {
    console.error('Backend executable not found:', backendPath);
    dialog.showErrorBox('Error', 'Backend server not found. Please reinstall WatchNexus.');
    app.quit();
    return;
  }
  
  const dataPath = getUserDataPath();
  const downloadPath = getDownloadsPath();
  
  console.log('Starting backend from:', backendPath);
  console.log('Data path:', dataPath);
  console.log('Download path:', downloadPath);
  
  backendProcess = spawn(backendPath, [], {
    cwd: path.dirname(backendPath),
    env: {
      ...process.env,
      // Database - use SQLite/TinyDB for portability
      DATA_PATH: dataPath,
      DOWNLOAD_PATH: downloadPath,
      // Server
      HOST: '127.0.0.1',
      PORT: '8001',
      // Security — JWT_SECRET is intentionally NOT set here. The backend now
      // generates and persists a strong, per-install secret to the data dir on
      // first launch (see ResolveJwtSecret in Program.cs). The old
      // 'watchnexus_desktop_' + Date.now() value was both predictable AND rotated
      // on every launch, silently logging the user out each restart.
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  backendProcess.stdout.on('data', (data) => {
    console.log(`[Backend] ${data.toString().trim()}`);
  });
  
  backendProcess.stderr.on('data', (data) => {
    console.error(`[Backend Error] ${data.toString().trim()}`);
  });
  
  backendProcess.on('error', (error) => {
    console.error('Failed to start backend:', error);
    dialog.showErrorBox('Error', 'Failed to start backend server: ' + error.message);
  });
  
  backendProcess.on('exit', (code) => {
    console.log('Backend exited with code:', code);
    if (code !== 0 && mainWindow) {
      dialog.showErrorBox('Error', 'Backend server crashed. Please restart WatchNexus.');
    }
  });
}

// Create the main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: 'WatchNexus',
    icon: path.join(__dirname, '..', 'assets', 'watchnexus.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#0a0a0f',
    show: false, // Don't show until ready
  });
  
  // Wait for window to be ready before showing
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  
  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from built files
    const indexPath = path.join(__dirname, '..', 'build', 'index.html');
    mainWindow.loadFile(indexPath);
  }
  
  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handlers for renderer process
ipcMain.handle('get-version', () => app.getVersion());
ipcMain.handle('get-downloads-path', () => getDownloadsPath());
ipcMain.handle('get-data-path', () => getUserDataPath());

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('select-file', async (event, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [{ name: 'All Files', extensions: ['*'] }]
  });
  return result.canceled ? null : result.filePaths[0];
});

// App lifecycle
app.whenReady().then(async () => {
  // Start backend first
  startBackend();
  
  // Wait for backend to be ready (simple delay for now)
  // In production, you'd want to poll the health endpoint
  await new Promise(resolve => setTimeout(resolve, isDev ? 100 : 3000));
  
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (backendProcess) {
    console.log('Shutting down backend...');
    backendProcess.kill();
    backendProcess = null;
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  dialog.showErrorBox('Error', 'An unexpected error occurred: ' + error.message);
});
