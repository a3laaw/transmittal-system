const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  printContent: (html) => ipcRenderer.invoke('print-content', html),
  chooseSavePath: () => ipcRenderer.invoke('choose-save-path'),
});
