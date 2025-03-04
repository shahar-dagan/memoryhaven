const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("api", {
  // Recording operations
  saveRecording: (buffer) => ipcRenderer.invoke("save-recording", buffer),
  transcribeVideo: (videoPath) =>
    ipcRenderer.invoke("transcribe-video", videoPath),
  compressVideo: (videoPath, options) =>
    ipcRenderer.invoke("compress-video", videoPath, options),

  // Database operations
  db: {
    addEntry: (entry) => ipcRenderer.invoke("db-add-entry", entry),
    updateEntry: (id, updates) =>
      ipcRenderer.invoke("db-update-entry", id, updates),
    getEntry: (id) => ipcRenderer.invoke("db-get-entry", id),
    getAllEntries: (limit = 100, offset = 0) =>
      ipcRenderer.invoke("db-get-all-entries", limit, offset),
    deleteEntry: (id) => ipcRenderer.invoke("db-delete-entry", id),
    searchEntries: (query) => ipcRenderer.invoke("db-search-entries", query),
    getAllTags: () => ipcRenderer.invoke("db-get-all-tags"),
  },
});

// Preload script for exposing Node.js APIs to the renderer process
window.addEventListener("DOMContentLoaded", () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const dependency of ["chrome", "node", "electron"]) {
    replaceText(`${dependency}-version`, process.versions[dependency]);
  }
});
