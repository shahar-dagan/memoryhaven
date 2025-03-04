// DOM Elements
const videoElement = document.getElementById("preview");
const startButton = document.getElementById("startRecording");
const stopButton = document.getElementById("stopRecording");
const entriesList = document.getElementById("entries-list");

// Global variables
let mediaRecorder;
let recordedChunks = [];
let stream;

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

      if (transcriptionResult.success) {
        console.log("Transcription completed");

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

          // Update the entry with the transcription and compressed video
          entryElement.innerHTML = `
            <h3>Entry: ${dateString} ${timeString}</h3>
            <video controls src="${compressedVideoUrl}" width="320"></video>
            <div class="transcription">
              <h4>Transcription:</h4>
              <p>${transcriptionResult.transcription}</p>
            </div>
            <div class="video-info">
              <p>Original: ${saveResult.fileName} (${formatFileSize(
            getFileSize(saveResult.filePath)
          )})</p>
              <p>Compressed: ${compressionResult.fileName} (${formatFileSize(
            getFileSize(compressionResult.compressedPath)
          )})</p>
            </div>
            <hr>
          `;

          // In a real implementation, we would continue with:
          // 4. Update the database
        } else {
          console.error("Video compression failed:", compressionResult.error);

          // Update the entry with just the transcription
          entryElement.innerHTML = `
            <h3>Entry: ${dateString} ${timeString}</h3>
            <video controls src="${url}" width="320"></video>
            <div class="transcription">
              <h4>Transcription:</h4>
              <p>${transcriptionResult.transcription}</p>
            </div>
            <p class="error">Compression failed: ${compressionResult.error}</p>
            <hr>
          `;
        }
      } else {
        console.error("Transcription failed:", transcriptionResult.error);
        entryElement.querySelector(
          "p"
        ).textContent = `Saved as: ${saveResult.fileName}. Transcription failed: ${transcriptionResult.error}`;
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
document.addEventListener("DOMContentLoaded", initializeCamera);
