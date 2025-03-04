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

        // Update the entry with the transcription
        entryElement.innerHTML = `
          <h3>Entry: ${dateString} ${timeString}</h3>
          <video controls src="${url}" width="320"></video>
          <div class="transcription">
            <h4>Transcription:</h4>
            <p>${transcriptionResult.transcription}</p>
          </div>
          <hr>
        `;

        // In a real implementation, we would continue with:
        // 3. Compress the video with FFmpeg
        // 4. Update the database
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

// Event listeners
startButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);

// Initialize camera on page load
document.addEventListener("DOMContentLoaded", initializeCamera);
