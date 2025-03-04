const path = require("path");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");

// Path to store compressed videos
const userDataPath = require("electron").app.getPath("userData");
const compressedPath = path.join(userDataPath, "compressed");

// Ensure directory exists
if (!fs.existsSync(compressedPath)) {
  fs.mkdirSync(compressedPath, { recursive: true });
}

/**
 * Compresses a video file using FFmpeg
 * @param {string} videoPath - Path to the original video file
 * @param {object} options - Compression options
 * @returns {Promise<object>} - Result object with success status and file path
 */
async function compressVideo(videoPath, options = {}) {
  return new Promise((resolve, reject) => {
    // Default options
    const defaultOptions = {
      videoBitrate: "1000k",
      audioBitrate: "128k",
      width: 1280,
      height: 720,
      fps: 30,
      format: "mp4",
    };

    // Merge default options with provided options
    const settings = { ...defaultOptions, ...options };

    // Create output file path
    const outputFileName = `${path.basename(
      videoPath,
      path.extname(videoPath)
    )}_compressed.${settings.format}`;
    const outputPath = path.join(compressedPath, outputFileName);

    console.log(`Compressing video: ${videoPath}`);
    console.log(`Output path: ${outputPath}`);
    console.log(`Compression settings:`, settings);

    // Configure FFmpeg
    ffmpeg(videoPath)
      .output(outputPath)
      .videoCodec("libx264")
      .size(`${settings.width}x${settings.height}`)
      .videoBitrate(settings.videoBitrate)
      .fps(settings.fps)
      .audioCodec("aac")
      .audioBitrate(settings.audioBitrate)
      .format(settings.format)
      .on("progress", (progress) => {
        console.log(`Processing: ${Math.floor(progress.percent)}% done`);
      })
      .on("end", () => {
        console.log("Video compression completed");
        resolve({
          success: true,
          originalPath: videoPath,
          compressedPath: outputPath,
          fileName: outputFileName,
          settings: settings,
        });
      })
      .on("error", (err) => {
        console.error("Error compressing video:", err);
        reject(err);
      })
      .run();
  });
}

module.exports = {
  compressVideo,
};
