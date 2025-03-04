const fs = require("fs");
const path = require("path");
const https = require("https");
const { execSync } = require("child_process");

// Create models directory if it doesn't exist
const modelsDir = path.join(__dirname, "..", "models");
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
  console.log("Created models directory");
}

// Install whisper-node which will download the model
console.log("Installing whisper-node and downloading model...");
try {
  execSync("npm install whisper-node", { stdio: "inherit" });
  console.log("Whisper model downloaded successfully");
} catch (error) {
  console.error("Error downloading Whisper model:", error);
}
