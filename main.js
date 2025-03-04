const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { transcribeVideo } = require("./src/scripts/transcription-service");
const { compressVideo } = require("./src/scripts/video-service");
const db = require("./src/scripts/database-service-lite");

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

// Create a directory for storing recordings if it doesn't exist
const userDataPath = app.getPath("userData");
const recordingsPath = path.join(userDataPath, "recordings");

// Add a variable to track database initialization status
let dbInitialized = false;

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
app.whenReady().then(async () => {
  ensureDirectoryExists(recordingsPath);

  // Try to initialize database
  try {
    await db.initializeDatabase();
    dbInitialized = true;
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Failed to initialize database:", error);
    dbInitialized = false;
  }

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
app.on("will-quit", async () => {
  if (dbInitialized) {
    try {
      await db.closeDatabase();
    } catch (error) {
      console.error("Error closing database:", error);
    }
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
  if (!dbInitialized) {
    return {
      success: false,
      error: "Database is not available",
    };
  }

  try {
    return await db.addEntry(entry);
  } catch (error) {
    console.error("Error adding entry:", error);
    return {
      success: false,
      error: error.message,
    };
  }
});

ipcMain.handle("db-update-entry", async (event, id, updates) => {
  if (!dbInitialized) {
    return {
      success: false,
      error: "Database is not available",
    };
  }

  try {
    return await db.updateEntry(id, updates);
  } catch (error) {
    console.error("Error updating entry:", error);
    return {
      success: false,
      error: error.message,
    };
  }
});

ipcMain.handle("db-get-entry", async (event, id) => {
  if (!dbInitialized) {
    return {
      success: false,
      error: "Database is not available",
    };
  }

  try {
    return await db.getEntryById(id);
  } catch (error) {
    console.error("Error getting entry:", error);
    return {
      success: false,
      error: error.message,
    };
  }
});

ipcMain.handle("db-get-all-entries", async (event, limit, offset) => {
  if (!dbInitialized) {
    return {
      success: false,
      error: "Database is not available",
      entries: [], // Return empty array as fallback
    };
  }

  try {
    return await db.getAllEntries(limit, offset);
  } catch (error) {
    console.error("Error getting entries:", error);
    return {
      success: false,
      error: error.message,
      entries: [],
    };
  }
});

ipcMain.handle("db-delete-entry", async (event, id) => {
  if (!dbInitialized) {
    return {
      success: false,
      error: "Database is not available",
    };
  }

  try {
    const result = await db.deleteEntry(id);

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
  } catch (error) {
    console.error("Error deleting entry:", error);
    return {
      success: false,
      error: error.message,
    };
  }
});

ipcMain.handle("db-search-entries", async (event, query) => {
  if (!dbInitialized) {
    return {
      success: false,
      error: "Database is not available",
      entries: [],
    };
  }

  try {
    return await db.searchEntries(query);
  } catch (error) {
    console.error("Error searching entries:", error);
    return {
      success: false,
      error: error.message,
      entries: [],
    };
  }
});

ipcMain.handle("db-get-all-tags", async (event) => {
  if (!dbInitialized) {
    return {
      success: false,
      error: "Database is not available",
      tags: [],
    };
  }

  try {
    return await db.getAllTags();
  } catch (error) {
    console.error("Error getting tags:", error);
    return {
      success: false,
      error: error.message,
      tags: [],
    };
  }
});
