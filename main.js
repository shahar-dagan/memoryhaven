const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { transcribeVideo } = require("./src/scripts/transcription-service");
const { compressVideo } = require("./src/scripts/video-service");
const db = require("./src/scripts/database-service");

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
      contextIsolation: true,
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

  // Initialize database
  db.initializeDatabase();

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

// Close database connection when app is about to quit
app.on("will-quit", () => {
  db.closeDatabase();
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

// Handle transcription requests
ipcMain.handle("transcribe-video", async (event, videoPath) => {
  try {
    console.log(`Starting transcription for: ${videoPath}`);
    const result = await transcribeVideo(videoPath);
    return result;
  } catch (error) {
    console.error("Error in transcription handler:", error);
    return {
      success: false,
      error: error.message,
    };
  }
});

// Handle video compression requests
ipcMain.handle("compress-video", async (event, videoPath, options) => {
  try {
    console.log(`Starting compression for: ${videoPath}`);
    const result = await compressVideo(videoPath, options);
    return result;
  } catch (error) {
    console.error("Error in compression handler:", error);
    return {
      success: false,
      error: error.message,
    };
  }
});

// Database operations
ipcMain.handle("db-add-entry", async (event, entry) => {
  return db.addEntry(entry);
});

ipcMain.handle("db-update-entry", async (event, id, updates) => {
  return db.updateEntry(id, updates);
});

ipcMain.handle("db-get-entry", async (event, id) => {
  return db.getEntryById(id);
});

ipcMain.handle("db-get-all-entries", async (event, limit, offset) => {
  try {
    return db.getAllEntries(limit, offset);
  } catch (error) {
    console.error("Error getting entries:", error);
    return {
      success: false,
      error: error.message,
      entries: [], // Return empty array as fallback
    };
  }
});

ipcMain.handle("db-delete-entry", async (event, id) => {
  const result = db.deleteEntry(id);

  // If successful and we have file paths, delete the files
  if (result.success && result.filePaths) {
    try {
      if (
        result.filePaths.originalPath &&
        fs.existsSync(result.filePaths.originalPath)
      ) {
        fs.unlinkSync(result.filePaths.originalPath);
      }

      if (
        result.filePaths.compressedPath &&
        fs.existsSync(result.filePaths.compressedPath)
      ) {
        fs.unlinkSync(result.filePaths.compressedPath);
      }
    } catch (error) {
      console.error("Error deleting files:", error);
    }
  }

  return result;
});

ipcMain.handle("db-search-entries", async (event, query) => {
  return db.searchEntries(query);
});

ipcMain.handle("db-get-all-tags", async (event) => {
  return db.getAllTags();
});
