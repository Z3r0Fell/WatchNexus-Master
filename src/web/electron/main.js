const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('http').request || require('https').request || null;
const http = require('http');
const https = require('https');

let mainWindow;
let backendProcess;
const isDev = process.env.NODE_ENV === 'development';

const request = (url, opts = {}) => new Promise((resolve, reject) => {
  const mod = url.startsWith('https') ? https : http;
  const req = mod.request(url, opts, (res) => {
    const chunks = [];
    res.on('data', (d) => chunks.push(d));
    res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
  });
  req.on('error', reject);
  req.setTimeout(opts.timeout || 5000, () => { req.destroy(); reject(new Error('timeout')); });
  if (opts.method) req.method = opts.method;
  if (opts.headers) req.setHeaders(opts.headers);
  req.write(opts.body || '');
  req.end();
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  dialog.showErrorBox('Error', 'An unexpected error occurred: ' + error.message);
  app.quit();
});

function getBackendPath() {
  if (isDev) return null;
  const basePath = app.isPackaged
    ? path.join(process.resourcesPath, 'backend')
    : path.join(__dirname, '..', '..', 'watchnexus', 'core', 'bin', 'Release', 'net10.0', 'publish');
  return {
    exe: 'dotnet',
    args: [path.join(basePath, 'WatchNexus.Core.dll')],
    dir: basePath,
  };
}

function getUserDataPath() {
  const dataPath = path.join(app.getPath('userData'), 'data');
  try { if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true }); }
  catch (e) { console.error('Failed to create data path:', e); }
  return dataPath;
}

function getDownloadsPath() {
  const defaultPath = path.join(app.getPath('downloads'), 'WatchNexus');
  try { if (!fs.existsSync(defaultPath)) fs.mkdirSync(defaultPath, { recursive: true }); }
  catch (e) { console.error('Failed to create downloads path:', e); }
  return defaultPath;
}

async function waitForBackend(port, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await request(`http://127.0.0.1:${port}/api/health`);
      if (res && res.status === 200) return true;
    } catch (e) { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

function startBackend() {
  const backendPath = getBackendPath();
  if (!backendPath) {
    console.log('Running in dev mode, backend should be started separately');
    return;
  }

  const dataPath = getUserDataPath();
  console.log('Starting backend from:', backendPath.dir);
  console.log('Data path:', dataPath);

  const dll = path.join(backendPath.dir, 'WatchNexus.Core.dll');
  if (!fs.existsSync(dll)) {
    console.error('Backend assembly not found:', dll);
    dialog.showErrorBox('Error', 'Backend server not found. Please reinstall WatchNexus.');
    app.quit();
    return;
  }

  const port = process.env.WATCHNEXUS_PORT || '8001';
  backendProcess = spawn(backendPath.exe, [dll], {
    cwd: backendPath.dir,
    windowsHide: true,
    env: {
      ...process.env,
      WATCHNEXUS_DATA_DIR: dataPath,
      WATCHNEXUS_PORT: port,
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
    app.quit();
  });

  backendProcess.on('exit', (code) => {
    console.log('Backend exited with code:', code);
    if (code !== 0 && mainWindow && !app.isQuitting) {
      dialog.showErrorBox('Error', 'Backend server crashed. Please restart WatchNexus.');
      app.quit();
    }
  });
}

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
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 15, y: 15 } : undefined,
    backgroundColor: '#0a0a0f',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '..', 'build', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  startBackend();

  const port = process.env.WATCHNEXUS_PORT || '8001';
  const ready = await waitForBackend(port, 30000);
  if (!ready && !isDev) {
    dialog.showErrorBox('Error', 'Backend server did not become ready in time. Please restart WatchNexus.');
  }

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

app.on('before-quit', async () => {
  app.isQuitting = true;
  if (backendProcess) {
    console.log('Shutting down backend...');
    backendProcess.kill('SIGTERM');
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('Backend did not exit gracefully, killing...');
        backendProcess.kill('SIGKILL');
        setTimeout(resolve, 1000);
      }, 5000);
      backendProcess.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    backendProcess = null;
  }
});

app.on('render-process-gone', (event, webContents, details) => {
  console.error('Render process gone:', details);
});

app.on('child-process-gone', (event, details) => {
  console.error('Child process gone:', details);
});

ipcMain.handle('get-version', () => app.getVersion());
ipcMain.handle('get-downloads-path', () => getDownloadsPath());
ipcMain.handle('get-data-path', () => getUserDataPath());

ipcMain.handle('select-folder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('select-file', async (event, filters) => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [{ name: 'All Files', extensions: ['*'] }]
  });
  return result.canceled ? null : result.filePaths[0];
});
