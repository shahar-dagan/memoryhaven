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
  // For now, just create a blob and display it
  // Later we'll save to file system and process with Whisper
  const blob = new Blob(recordedChunks, { type: "video/webm" });
  const url = URL.createObjectURL(blob);

  // Create a temporary entry in the list
  const date = new Date();
  const dateString = date.toISOString().split("T")[0];
  const timeString = date.toTimeString().split(" ")[0];

  const entryElement = document.createElement("div");
  entryElement.className = "entry";
  entryElement.innerHTML = `
    <h3>Entry: ${dateString} ${timeString}</h3>
    <video controls src="${url}" width="320"></video>
    <p>Transcription pending...</p>
    <hr>
  `;

  // If this is the first entry, clear the "No entries" message
  if (entriesList.querySelector("p")) {
    entriesList.innerHTML = "";
  }

  // Add to the beginning of the list
  entriesList.insertBefore(entryElement, entriesList.firstChild);

  console.log("Recording saved temporarily");

  // In a real implementation, we would:
  // 1. Save the file to disk
  // 2. Extract audio and send to Whisper for transcription
  // 3. Compress the video with FFmpeg
  // 4. Update the database
}

// Event listeners
startButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);

// Initialize camera on page load
document.addEventListener("DOMContentLoaded", initializeCamera);
