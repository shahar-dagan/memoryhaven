const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Load the index.html file
  mainWindow.loadFile("src/index.html");

  // Open DevTools during development
  // mainWindow.webContents.openDevTools();

  // Handle window being closed
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Create window when Electron has finished initialization
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On macOS, recreate the window when dock icon is clicked and no windows are open
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle IPC messages from renderer process
// We'll add more handlers as we develop features
