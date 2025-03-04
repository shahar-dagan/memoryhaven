const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const ffmpeg = require("fluent-ffmpeg");
const nodeWhisper = require("node-whisper");

// Path to store temporary audio files
const userDataPath = require("electron").app.getPath("userData");
const tempPath = path.join(userDataPath, "temp");
const modelsPath = path.join(userDataPath, "models");

// Ensure directories exist
if (!fs.existsSync(tempPath)) {
  fs.mkdirSync(tempPath, { recursive: true });
}

if (!fs.existsSync(modelsPath)) {
  fs.mkdirSync(modelsPath, { recursive: true });
}

// Function to extract audio from video
function extractAudio(videoPath) {
  return new Promise((resolve, reject) => {
    const audioPath = path.join(
      tempPath,
      `${path.basename(videoPath, ".webm")}.wav`
    );

    ffmpeg(videoPath)
      .output(audioPath)
      .audioCodec("pcm_s16le")
      .audioChannels(1)
      .audioFrequency(16000)
      .on("end", () => {
        console.log(`Audio extracted to ${audioPath}`);
        resolve(audioPath);
      })
      .on("error", (err) => {
        console.error("Error extracting audio:", err);
        reject(err);
      })
      .run();
  });
}

// Function to transcribe audio using Whisper
async function transcribeAudio(audioPath) {
  try {
    console.log("Starting transcription...");

    // Initialize the whisper model (this will download it if not already present)
    const whisper = await nodeWhisper.whisper({
      modelName: "base", // Options: tiny, base, small, medium, large
      modelPath: modelsPath,
    });

    // Transcribe the audio file
    const result = await whisper.transcribe(audioPath, {
      language: "auto", // Auto-detect language
    });

    console.log("Transcription completed");
    return result.text;
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
}

// Clean up temporary files
function cleanupTempFiles(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted temporary file: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error deleting temporary file ${filePath}:`, error);
  }
}

// Main function to process video and get transcription
async function transcribeVideo(videoPath) {
  try {
    // Step 1: Extract audio from video
    const audioPath = await extractAudio(videoPath);

    // Step 2: Transcribe the audio
    const transcription = await transcribeAudio(audioPath);

    // Step 3: Clean up temporary audio file
    cleanupTempFiles(audioPath);

    return {
      success: true,
      transcription: transcription,
    };
  } catch (error) {
    console.error("Error in transcription process:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  transcribeVideo,
};
