<div align="center">

# ðŸŽµ Negaafy

**A Spotify-style desktop music player â€” stream any song, synced lyrics, playlists, and offline downloads.**

Ù…Ø´ØºÙ„ Ù…ÙˆØ³ÙŠÙ‚Ù‰ Ø´Ø¨Ù‡ Ø³Ø¨ÙˆØªÙŠÙØ§ÙŠ â€” Ø´ØºÙ‘Ù„ Ø£ÙŠ Ø£ØºÙ†ÙŠØ©ØŒ ÙƒÙ„Ù…Ø§Øª Ù…ØªØ²Ø§Ù…Ù†Ø©ØŒ Ø¨Ù„Ø§ÙŠÙ„Ø³ØªØ§ØªØŒ ÙˆØªØ­Ù…ÙŠÙ„ Ø£ÙˆÙÙ„Ø§ÙŠÙ†.

[![Electron](https://img.shields.io/badge/Electron-38-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/License-GPL--3.0-blue)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows)](https://www.microsoft.com/windows)

</div>

---

## âœ¨ Features | Ø§Ù„Ù…Ù…ÙŠØ²Ø§Øª

| Feature | Ø§Ù„ÙˆØµÙ |
|---------|-------|
| ðŸ” **Search & Stream** | Search for any song and stream it instantly from YouTube â€” Ø§Ø¨Ø­Ø« Ø¹Ù† Ø£ÙŠ Ø£ØºÙ†ÙŠØ© ÙˆØ´ØºÙ„Ù‡Ø§ ÙÙˆØ±Ø§Ù‹ |
| ðŸ“ **Synced Lyrics** | Real-time synchronized lyrics that highlight as the song plays â€” ÙƒÙ„Ù…Ø§Øª Ù…ØªØ²Ø§Ù…Ù†Ø© Ø¨ØªØªØ­Ø±Ùƒ Ù…Ø¹ Ø§Ù„Ø£ØºÙ†ÙŠØ© |
| â¤ï¸ **Like & Library** | Like songs and build your personal library â€” Ù„Ø§ÙŠÙƒ Ù„Ù„Ø£ØºØ§Ù†ÙŠ ÙˆØ¨Ù†Ø§Ø¡ Ù…ÙƒØªØ¨ØªÙƒ Ø§Ù„Ø´Ø®ØµÙŠØ© |
| ðŸ“‹ **Playlists** | Create, rename, and manage custom playlists â€” Ø§Ø¹Ù…Ù„ Ø¨Ù„Ø§ÙŠÙ„Ø³ØªØ§Øª ÙˆØ¸Ø¨Ø·Ù‡Ø§ Ø²ÙŠ Ù…Ø§ ØªØ­Ø¨ |
| â¬‡ï¸ **Offline Downloads** | Download songs as MP3 for offline listening â€” Ø­Ù…Ù‘Ù„ Ø§Ù„Ø£ØºØ§Ù†ÙŠ MP3 Ø¹Ø´Ø§Ù† ØªØ³Ù…Ø¹Ù‡Ø§ Ù…Ù† ØºÙŠØ± Ù†Øª |
| â˜ï¸ **Google Drive Sync** | Sync your library across all your PCs via Google Drive â€” Ø²Ø§Ù…Ù† Ù…ÙƒØªØ¨ØªÙƒ Ø¹Ù„Ù‰ ÙƒÙ„ Ø£Ø¬Ù‡Ø²ØªÙƒ |
| ðŸ“» **Smart Radio** | Auto-play similar songs based on what you're listening to â€” Ø±Ø§Ø¯ÙŠÙˆ Ø°ÙƒÙŠ Ø¨ÙŠØ´ØºÙ„ Ø£ØºØ§Ù†ÙŠ Ø´Ø¨Ù‡ Ø§Ù„Ù„ÙŠ Ø¨ØªØ³Ù…Ø¹Ù‡Ø§ |
| ðŸŽ¯ **Daily Mixes** | Personalized daily mixes based on your taste â€” Ù…ÙŠÙƒØ³Ø§Øª ÙŠÙˆÙ…ÙŠØ© Ù…Ø®ØµØµØ© Ù„ÙŠÙƒ |
| ðŸ”¥ **Trending & New Releases** | Discover trending songs and new releases â€” Ø§ÙƒØªØ´Ù Ø§Ù„Ø£ØºØ§Ù†ÙŠ Ø§Ù„ØªØ±Ù†Ø¯ ÙˆØ§Ù„Ø¥ØµØ¯Ø§Ø±Ø§Øª Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø© |
| ðŸ”„ **Auto Updates** | The app updates itself automatically â€” Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ Ø¨ÙŠØ­Ø¯Ù‘Ø« Ù†ÙØ³Ù‡ Ø£ÙˆØªÙˆÙ…Ø§ØªÙŠÙƒ |

---

## ðŸ—ï¸ Architecture | Ø§Ù„Ø¨Ù†ÙŠØ©

```
nagham/
â”œâ”€â”€ main.js              # Electron main process â€” window, IPC, download queue
â”œâ”€â”€ preload.js           # Context bridge â€” secure API for the renderer
â”œâ”€â”€ renderer/            # Frontend UI (HTML/CSS/JS)
â”‚   â”œâ”€â”€ index.html       # Main app layout
â”‚   â”œâ”€â”€ app.js           # UI logic â€” home, search, playlists, queue, player
â”‚   â”œâ”€â”€ styles.css       # Spotify-inspired dark theme
â”‚   â”œâ”€â”€ platform.js      # Platform abstraction layer
â”‚   â””â”€â”€ radio.js         # Radio/autoplay UI
â”œâ”€â”€ src/                 # Backend modules
â”‚   â”œâ”€â”€ ytdlp.js         # YouTube search, stream URLs, downloads (via yt-dlp)
â”‚   â”œâ”€â”€ innertube.js     # YouTube Music API â€” trending, new releases
â”‚   â”œâ”€â”€ server.js        # Local audio server with seeking support
â”‚   â”œâ”€â”€ library.js       # Library stored in Google Drive folder
â”‚   â”œâ”€â”€ lyrics.js        # Synced lyrics from LRCLIB
â”‚   â”œâ”€â”€ algorithm.js     # Recommendation engine â€” daily mixes, autoplay
â”‚   â”œâ”€â”€ audiocache.js    # Audio caching for instant playback
â”‚   â”œâ”€â”€ pyworker.js      # Python worker for fast YouTube extraction
â”‚   â”œâ”€â”€ tracks.js        # Track data helpers
â”‚   â”œâ”€â”€ updates.js       # Auto-update via electron-updater
â”‚   â””â”€â”€ py/worker.py     # Python extraction worker
â”œâ”€â”€ build/               # App icons
â”œâ”€â”€ android/             # Android (Capacitor) wrapper
â””â”€â”€ scripts/             # Build utilities
```

---

## ðŸš€ Quick Start | ØªØ´ØºÙŠÙ„ Ø³Ø±ÙŠØ¹

### Prerequisites | Ø§Ù„Ù…ØªØ·Ù„Ø¨Ø§Øª
- [Node.js](https://nodejs.org/) (v18+)
- Windows 10/11

### Run from Source | ØªØ´ØºÙŠÙ„ Ù…Ù† Ø§Ù„Ø³ÙˆØ±Ø³
```bash
# Clone the repo
git clone https://github.com/ayato505/negaafy.git
cd negaafy

# Install dependencies
npm install

# Run the app
npm start
```

### Run the Portable App | ØªØ´ØºÙŠÙ„ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ Ø§Ù„Ø¬Ø§Ù‡Ø²
1. Download the latest release
2. Run `Negaafy.exe` from the extracted folder
3. Keep the whole `Negaafy` folder together (you can pin the exe to the taskbar)

---

## â˜ï¸ Google Drive Sync | Ù…Ø²Ø§Ù…Ù†Ø© Ø¬ÙˆØ¬Ù„ Ø¯Ø±Ø§ÙŠÙ

1. Install [Google Drive for Desktop](https://www.google.com/drive/download/) and sign in
2. In Negaafy, go to **Settings â†’ Library folder â†’ Changeâ€¦**
3. Choose a folder inside `My Drive` (e.g. `G:\My Drive\Negaafy`)

Your library file (`nagham-library.json`) and downloaded songs (`Songs/`) will sync to every PC.

---

## ðŸ”§ How it Works | Ø¥Ø²Ø§ÙŠ Ø¨ÙŠØ´ØªØºÙ„

| Module | What it does |
|--------|-------------|
| `src/ytdlp.js` | YouTube search, song radio, stream URLs, downloads via yt-dlp (auto-fetched on first run) |
| `src/innertube.js` | Direct YouTube Music API â€” trending, new releases, related content |
| `src/server.js` | Local HTTP audio server: serves downloaded files or proxies YouTube streams with seeking |
| `src/library.js` | Manages liked songs, playlists, history â€” stored in Google Drive folder |
| `src/lyrics.js` | Fetches synced lyrics (LRC) from LRCLIB.net â€” no API key needed |
| `src/algorithm.js` | Recommendation engine: analyzes listening history to generate daily mixes and autoplay |
| `src/audiocache.js` | Caches audio for instant playback and prefetching |
| `main.js` | Electron main process: window management, IPC handlers, download queue |
| `renderer/` | Full Spotify-style UI: search, playlists, queue, now-playing, synced lyrics view |

---

## ðŸ› ï¸ Build | Ø¨Ù†Ø§Ø¡ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚

```bash
# Build Windows installer (NSIS)
npm run dist

# Or build both portable + installer
npx electron-builder --win portable nsis
```

---

## ðŸ› Troubleshooting | Ø­Ù„ Ø§Ù„Ù…Ø´Ø§ÙƒÙ„

| Problem | Solution |
|---------|----------|
| Songs stop playing | YouTube changed something â†’ **Settings â†’ YouTube engine â†’ Update** |
| Library not syncing | Make sure Google Drive for Desktop is running |
| App won't start | Delete `%AppData%/Nagham` folder and restart |

---

## ðŸ“„ License | Ø§Ù„Ø±Ø®ØµØ©

This project is licensed under the **GPL-3.0** License.

---

<div align="center">

**Made with â¤ï¸ by [ayato](https://github.com/ayato505)**

</div>
