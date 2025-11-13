// Preload script for Electron
// This runs before the web page loads and has access to both Node.js and DOM APIs

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Add any Electron-specific APIs here if needed
  platform: process.platform,
  version: process.versions.electron,
});

// Log that preload script loaded successfully
console.log('Preload script loaded successfully');
