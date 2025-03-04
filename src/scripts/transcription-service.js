const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const ffmpeg = require("fluent-ffmpeg");
const { app } = require("electron");

// Get the app data path
const appDataPath = app.getPath("userData");
const recordingsDir = path.join(appDataPath, "recordings");
const tempDir = path.join(appDataPath, "temp");

// Get the absolute path to the whisper.cpp executable and model
const projectRoot = path.resolve(__dirname, "../..");
const whisperPath = path.join(
  projectRoot,
  "whisper.cpp",
  "build",
  "bin",
  "whisper-cli"
);
const modelPath = path.join(
  projectRoot,
  "whisper.cpp",
  "models",
  "ggml-base.en.bin"
);

// Log paths for debugging
console.log("Whisper executable path:", whisperPath);
console.log("Whisper model path:", modelPath);

// Ensure directories exist
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
}
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Extract audio from video file
async function extractAudio(videoPath) {
  const audioFileName = path.basename(videoPath).replace(".webm", ".wav");
  const audioPath = path.join(tempDir, audioFileName);

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .output(audioPath)
      .audioCodec("pcm_s16le")
      .audioChannels(1) // Mono audio for better transcription
      .audioFrequency(16000) // 16kHz sample rate for better transcription
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

// Test the whisper.cpp executable directly
async function testWhisperExecutable() {
  return new Promise((resolve, reject) => {
    const whisperDir = path.join(projectRoot, "whisper.cpp");
    const command = `cd "${whisperDir}" && "${whisperPath}" --help`;

    console.log("Testing whisper executable with command:", command);

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error("Whisper test error:", error);
        console.error("Stderr:", stderr);
        reject(error);
      } else {
        console.log("Whisper test output:", stdout);
        resolve(true);
      }
    });
  });
}

// Transcribe audio using whisper.cpp executable
async function transcribeAudio(audioPath) {
  try {
    console.log("Starting transcription with whisper.cpp...");

    // Test the executable first
    try {
      await testWhisperExecutable();
    } catch (error) {
      console.error("Whisper executable test failed:", error);
      // Continue anyway to see the specific error with the actual command
    }

    // Verify that the whisper executable exists
    if (!fs.existsSync(whisperPath)) {
      throw new Error(`Whisper executable not found at: ${whisperPath}`);
    }

    // Verify that the model exists
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Whisper model not found at: ${modelPath}`);
    }

    // Create output file path
    const outputPath = audioPath.replace(".wav", ".txt");

    // Run whisper.cpp command with full paths
    return new Promise((resolve, reject) => {
      // Use absolute paths for everything to avoid directory issues
      const command = `"${whisperPath}" -m "${modelPath}" -f "${audioPath}" -o "${outputPath}"`;

      console.log("Executing command:", command);

      // Execute in the whisper.cpp directory
      const options = {
        cwd: path.join(projectRoot, "whisper.cpp"),
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer for output
      };

      exec(command, options, (error, stdout, stderr) => {
        if (stderr) {
          console.log("Whisper stderr:", stderr);
        }

        if (stdout) {
          console.log("Whisper stdout:", stdout);
        }

        if (error) {
          console.error(`Whisper exec error: ${error}`);
          return reject(error);
        }

        // Check if output file exists
        if (fs.existsSync(outputPath)) {
          // Read the output file
          fs.readFile(outputPath, "utf8", (err, data) => {
            if (err) {
              console.error(`Error reading transcription file: ${err}`);
              return reject(err);
            }

            resolve(data);

            // Clean up the output file
            fs.unlink(outputPath, (err) => {
              if (err)
                console.error(`Error deleting transcription file: ${err}`);
            });
          });
        } else {
          reject(new Error(`Output file not created: ${outputPath}`));
        }
      });
    });
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
}

// Fallback transcription function
function fallbackTranscription() {
  return "This is a placeholder transcription. The whisper.cpp transcription service is being configured.";
}

// Main function to transcribe a video
async function transcribeVideo(videoPath) {
  try {
    const audioPath = await extractAudio(videoPath);

    try {
      const transcription = await transcribeAudio(audioPath);

      // Clean up the temporary audio file
      fs.unlinkSync(audioPath);

      return transcription;
    } catch (error) {
      console.error("Error in transcription process:", error);

      // Clean up the temporary audio file
      try {
        fs.unlinkSync(audioPath);
      } catch (e) {
        console.error("Error cleaning up audio file:", e);
      }

      // Return fallback transcription
      return fallbackTranscription();
    }
  } catch (error) {
    console.error("Error extracting audio:", error);
    return fallbackTranscription();
  }
}

module.exports = {
  transcribeVideo,
};
