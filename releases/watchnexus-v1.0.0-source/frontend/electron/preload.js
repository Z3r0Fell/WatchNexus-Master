const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('get-version'),
  getDownloadsPath: () => ipcRenderer.invoke('get-downloads-path'),
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
  
  // File system
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFile: (filters) => ipcRenderer.invoke('select-file', filters),
  
  // Platform info
  platform: process.platform,
  isElectron: true,
});
