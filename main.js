const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

// Create a directory for storing recordings if it doesn't exist
const userDataPath = app.getPath("userData");
const recordingsPath = path.join(userDataPath, "recordings");

function ensureDirectoryExists(directory) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
    console.log(`Created directory: ${directory}`);
  }
}

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
app.whenReady().then(() => {
  ensureDirectoryExists(recordingsPath);
  createWindow();
});

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
ipcMain.handle("save-recording", async (event, buffer) => {
  try {
    const timestamp = new Date().toISOString().replace(/:/g, "-");
    const filePath = path.join(recordingsPath, `recording-${timestamp}.webm`);

    fs.writeFileSync(filePath, Buffer.from(buffer));

    return {
      success: true,
      filePath: filePath,
      fileName: path.basename(filePath),
    };
  } catch (error) {
    console.error("Error saving recording:", error);
    return {
      success: false,
      error: error.message,
    };
  }
});
