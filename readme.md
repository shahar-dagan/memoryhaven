# MemoryHaven

A local-first video diary application with AI-powered transcription capabilities.

![MemoryHaven Logo](src/assets/logo.png)

## 📝 Description

MemoryHaven is a desktop application that allows you to record, store, and search through video diary entries. It uses AI transcription to make your memories searchable and provides a heatmap visualization to track your journaling consistency.

### Key Features

- 📹 Record video diary entries directly from your webcam
- 🔍 AI-powered transcription using Whisper for searchable entries
- 🔒 Local-first architecture for privacy and data ownership
- 📊 Consistency heatmap to visualize your journaling habits
- 🔎 Search functionality to find specific memories

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- [Python](https://www.python.org/) (v3.8 or higher) for Whisper model support
- [FFmpeg](https://ffmpeg.org/) for video processing

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/shahar-dagan/memoryhaven.git
   cd memoryhaven
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up the Whisper model:

   ```bash
   # This will download the necessary Whisper model
   node src/scripts/download-whisper-model.js
   ```

4. Rebuild native dependencies:
   ```bash
   npm run rebuild
   ```

### Running the Application

```bash
# Start the application in development mode
npm run dev

# Start the application in production mode
npm start
```

### Building for Distribution

```bash
# Build for your current platform
npm run build
```

## 🧩 Project Structure

- `main.js` - Main Electron process
- `preload.js` - Preload script for secure IPC communication
- `src/`
  - `index.html` - Main application UI
  - `styles/` - CSS stylesheets
  - `assets/` - Images and other static assets
  - `scripts/`
    - `renderer.js` - UI logic
    - `database-service-lite.js` - SQLite database interactions
    - `transcription-service.js` - Video transcription using Whisper
    - `video-service.js` - Video compression and processing
    - `heatmap.js` - Consistency visualization

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Current Development Tasks

- Fix bugs: with Whisper integration
- Search Functionality: Enhance ability to search through transcriptions
- UI Improvements: Enhance the user interface and experience

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Whisper](https://github.com/openai/whisper) for the speech recognition model
- [Electron](https://www.electronjs.org/) for the desktop application framework
- [SQLite](https://www.sqlite.org/) for the local database
- [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) for video processing
- [better-sqlite3/sqlite3](https://github.com/WiseLibs/better-sqlite3) for database operations
- [whisper-node](https://github.com/openai/whisper) for Node.js bindings to Whisper AI
- [electron-builder](https://www.electron.build/) for application packaging

## 🛠️ Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Electron
- **Database**: SQLite
- **AI Transcription**: Whisper AI (via whisper.cpp)
- **Video Processing**: FFmpeg (via fluent-ffmpeg)
- **Build Tools**: electron-builder
