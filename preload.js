// preload.js — runs in Electron renderer with context isolation
// Exposes a safe API to the renderer via contextBridge
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: process.platform,
  isElectron: true,

  // File system dialogs
  chooseSavePath: () => ipcRenderer.invoke('choose-save-path'),
  chooseFile: () => ipcRenderer.invoke('choose-file'),

  // App info
  getVersion: () => ipcRenderer.invoke('get-version'),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
});
