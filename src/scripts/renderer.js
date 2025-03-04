// DOM Elements
const videoElement = document.getElementById("preview");
const startButton = document.getElementById("startRecording");
const stopButton = document.getElementById("stopRecording");
const entriesList = document.getElementById("entries-list");
const searchInput = document.getElementById("search-input");
const searchButton = document.getElementById("search-button");

// Global variables
let mediaRecorder;
let recordedChunks = [];
let stream;
let heatmap;

// Initialize camera preview
async function initializeCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    videoElement.srcObject = stream;
    startButton.disabled = false;
  } catch (error) {
    console.error("Error accessing camera:", error);
    alert("Could not access camera and microphone. Please check permissions.");
  }
}

// Start recording
function startRecording() {
  recordedChunks = [];

  // Create MediaRecorder instance
  mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });

  // Handle data available event
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  // Handle recording stop
  mediaRecorder.onstop = saveRecording;

  // Start recording
  mediaRecorder.start();

  // Update UI
  startButton.disabled = true;
  stopButton.disabled = false;

  console.log("Recording started");
}

// Stop recording
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();

    // Update UI
    startButton.disabled = false;
    stopButton.disabled = true;

    console.log("Recording stopped");
  }
}

// Save the recording
async function saveRecording() {
  // Create a blob from the recorded chunks
  const blob = new Blob(recordedChunks, { type: "video/webm" });
  const url = URL.createObjectURL(blob);

  // Create a temporary entry in the list
  const date = new Date();
  const dateString = date.toISOString().split("T")[0];
  const timeString = date.toTimeString().split(" ")[0];

  // Create a loading entry
  const entryElement = document.createElement("div");
  entryElement.className = "entry";
  entryElement.innerHTML = `
    <h3>Entry: ${dateString} ${timeString}</h3>
    <video controls src="${url}" width="320"></video>
    <p>Saving recording...</p>
    <hr>
  `;

  // If this is the first entry, clear the "No entries" message
  if (entriesList.querySelector("p")) {
    entriesList.innerHTML = "";
  }

  // Add to the beginning of the list
  entriesList.insertBefore(entryElement, entriesList.firstChild);

  try {
    // Step 1: Save the file to disk
    // Convert blob to ArrayBuffer for sending over IPC
    const arrayBuffer = await blob.arrayBuffer();
    const saveResult = await window.api.saveRecording(arrayBuffer);

    if (saveResult.success) {
      console.log(`Recording saved to: ${saveResult.filePath}`);

      // Update the entry with the saved file information
      entryElement.querySelector(
        "p"
      ).textContent = `Saved as: ${saveResult.fileName}. Transcribing...`;

      // Step 2: Extract audio and send to Whisper for transcription
      const transcriptionResult = await window.api.transcribeVideo(
        saveResult.filePath
      );

      let transcription = "";
      if (transcriptionResult.success) {
        console.log("Transcription completed");
        transcription = transcriptionResult.transcription;

        // Update status message
        entryElement.querySelector(
          "p"
        ).textContent = `Transcription completed. Compressing video...`;

        // Step 3: Compress the video with FFmpeg
        const compressionOptions = {
          videoBitrate: "800k",
          audioBitrate: "96k",
          width: 854,
          height: 480,
          fps: 24,
          format: "mp4",
        };

        const compressionResult = await window.api.compressVideo(
          saveResult.filePath,
          compressionOptions
        );

        if (compressionResult.success) {
          console.log("Video compression completed");

          // Create a URL for the compressed video
          const compressedVideoUrl = `file://${compressionResult.compressedPath}`;

          // Get file sizes
          const originalSize = getFileSize(saveResult.filePath);
          const compressedSize = getFileSize(compressionResult.compressedPath);

          // Step 4: Save to database
          const entryData = {
            title: `Entry ${dateString}`,
            date: dateString,
            time: timeString,
            originalPath: saveResult.filePath,
            compressedPath: compressionResult.compressedPath,
            transcription: transcription,
            fileSize: originalSize,
            compressedSize: compressedSize,
            // Extract tags from transcription (simple implementation)
            tags: extractTagsFromTranscription(transcription),
          };

          const dbResult = await window.api.db.addEntry(entryData);

          if (dbResult.success) {
            console.log(`Entry saved to database with ID: ${dbResult.entryId}`);

            // Update the entry with all information
            entryElement.innerHTML = `
              <h3>Entry: ${dateString} ${timeString}</h3>
              <video controls src="${compressedVideoUrl}" width="320"></video>
              <div class="transcription">
                <h4>Transcription:</h4>
                <p>${transcription}</p>
              </div>
              <div class="video-info">
                <p>Original: ${saveResult.fileName} (${formatFileSize(
              originalSize
            )})</p>
                <p>Compressed: ${compressionResult.fileName} (${formatFileSize(
              compressedSize
            )})</p>
              </div>
              <div class="entry-actions">
                <button class="btn small" onclick="deleteEntry(${
                  dbResult.entryId
                })">Delete</button>
              </div>
              <hr>
            `;

            // Add data attribute for entry ID
            entryElement.dataset.entryId = dbResult.entryId;

            // Update heatmap
            updateHeatmap();
          } else {
            console.error("Failed to save entry to database:", dbResult.error);

            // Update the entry with compression and transcription info
            entryElement.innerHTML = `
              <h3>Entry: ${dateString} ${timeString}</h3>
              <video controls src="${compressedVideoUrl}" width="320"></video>
              <div class="transcription">
                <h4>Transcription:</h4>
                <p>${transcription}</p>
              </div>
              <div class="video-info">
                <p>Original: ${saveResult.fileName} (${formatFileSize(
              originalSize
            )})</p>
                <p>Compressed: ${compressionResult.fileName} (${formatFileSize(
              compressedSize
            )})</p>
              </div>
              <p class="error">Database error: ${dbResult.error}</p>
              <hr>
            `;

            // Update heatmap
            updateHeatmap();
          }
        } else {
          console.error("Video compression failed:", compressionResult.error);

          // Save to database without compression info
          const entryData = {
            title: `Entry ${dateString}`,
            date: dateString,
            time: timeString,
            originalPath: saveResult.filePath,
            transcription: transcription,
            fileSize: getFileSize(saveResult.filePath),
            tags: extractTagsFromTranscription(transcription),
          };

          const dbResult = await window.api.db.addEntry(entryData);

          if (dbResult.success) {
            console.log(`Entry saved to database with ID: ${dbResult.entryId}`);

            // Update the entry with just the transcription
            entryElement.innerHTML = `
              <h3>Entry: ${dateString} ${timeString}</h3>
              <video controls src="${url}" width="320"></video>
              <div class="transcription">
                <h4>Transcription:</h4>
                <p>${transcription}</p>
              </div>
              <p class="error">Compression failed: ${
                compressionResult.error
              }</p>
              <div class="entry-actions">
                ${
                  dbResult.success
                    ? `<button class="btn small" onclick="deleteEntry(${dbResult.entryId})">Delete</button>`
                    : ""
                }
              </div>
              <hr>
            `;

            if (dbResult.success) {
              entryElement.dataset.entryId = dbResult.entryId;
            }

            // Update heatmap
            updateHeatmap();
          }
        }
      } else {
        console.error("Transcription failed:", transcriptionResult.error);

        // Save to database without transcription
        const entryData = {
          title: `Entry ${dateString}`,
          date: dateString,
          time: timeString,
          originalPath: saveResult.filePath,
          fileSize: getFileSize(saveResult.filePath),
        };

        const dbResult = await window.api.db.addEntry(entryData);

        if (dbResult.success) {
          console.log(`Entry saved to database with ID: ${dbResult.entryId}`);
        } else {
          console.error("Failed to save entry to database:", dbResult.error);
        }

        entryElement.querySelector(
          "p"
        ).textContent = `Saved as: ${saveResult.fileName}. Transcription failed: ${transcriptionResult.error}`;

        if (dbResult.success) {
          entryElement.dataset.entryId = dbResult.entryId;

          // Add delete button
          const actionsDiv = document.createElement("div");
          actionsDiv.className = "entry-actions";
          actionsDiv.innerHTML = `<button class="btn small" onclick="deleteEntry(${dbResult.entryId})">Delete</button>`;
          entryElement.appendChild(actionsDiv);

          // Update heatmap
          updateHeatmap();
        }
      }
    } else {
      console.error("Failed to save recording:", saveResult.error);
      entryElement.querySelector(
        "p"
      ).textContent = `Error saving: ${saveResult.error}`;
    }
  } catch (error) {
    console.error("Error in save process:", error);
    entryElement.querySelector("p").textContent = `Error: ${error.message}`;
  }
}

// Load all entries from the database
async function loadEntries() {
  try {
    const result = await window.api.db.getAllEntries();

    if (result.success && result.entries && result.entries.length > 0) {
      // Clear the entries list
      entriesList.innerHTML = "";

      // Add each entry to the list
      result.entries.forEach((entry) => {
        const entryElement = createEntryElement(entry);
        entriesList.appendChild(entryElement);
      });
    } else if (result.success) {
      // No entries found
      entriesList.innerHTML =
        "<p>No entries yet. Record your first memory!</p>";
    } else {
      console.error("Failed to load entries:", result.error);
      entriesList.innerHTML = `
        <div class="error-message">
          <p>Could not load your entries: ${result.error}</p>
          <p>Your recordings will still be saved, but they may not appear in this list.</p>
        </div>
      `;
    }
  } catch (error) {
    console.error("Error loading entries:", error);
    entriesList.innerHTML = `
      <div class="error-message">
        <p>Error loading entries: ${error.message}</p>
        <p>Your recordings will still be saved, but they may not appear in this list.</p>
      </div>
    `;
  }
}

// Create an entry element from database data
function createEntryElement(entry) {
  const entryElement = document.createElement("div");
  entryElement.className = "entry";
  entryElement.innerHTML = `
    <h3>Entry: ${entry.date} ${entry.time}</h3>
    <video controls src="${entry.originalPath}" width="320"></video>
    <div class="transcription">
      <h4>Transcription:</h4>
      <p>${entry.transcription}</p>
    </div>
    <div class="video-info">
      <p>Original: ${entry.fileName} (${formatFileSize(entry.fileSize)})</p>
    </div>
    <div class="entry-actions">
      <button class="btn small" onclick="deleteEntry(${
        entry.id
      })">Delete</button>
    </div>
    <hr>
  `;
  entryElement.dataset.entryId = entry.id;
  return entryElement;
}

// Helper function to get file size
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    console.error("Error getting file size:", error);
    return 0;
  }
}

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Event listeners
startButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);

// Initialize camera on page load
document.addEventListener("DOMContentLoaded", () => {
  initializeCamera();
  initializeHeatmap();
  loadEntries();
});

// Function to initialize the heatmap
function initializeHeatmap() {
  heatmap = new EntryHeatmap("consistency-heatmap", {
    weeksToShow: 26, // Show 6 months
    cellSize: 14,
    cellMargin: 3,
  });

  // Load data for the heatmap
  updateHeatmap();
}

// Function to update the heatmap with latest data
async function updateHeatmap() {
  try {
    const result = await window.api.db.getAllEntries(1000);

    if (result.success && result.entries && heatmap) {
      heatmap.update(result.entries);
    } else if (!result.success) {
      console.error("Failed to load entries for heatmap:", result.error);
    }
  } catch (error) {
    console.error("Error updating heatmap:", error);
  }
}
