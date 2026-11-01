<div align="center">

# 🎵 Negaafy

**A Spotify-style desktop music player — stream any song, synced lyrics, playlists, and offline downloads.**

مشغل موسيقى شبه سبوتيفاي — شغّل أي أغنية، كلمات متزامنة، بلايلستات، وتحميل أوفلاين.

[![Electron](https://img.shields.io/badge/Electron-38-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/License-GPL--3.0-blue)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows)](https://www.microsoft.com/windows)

</div>

---

## ✨ Features | المميزات

| Feature | الوصف |
|---------|-------|
| 🔍 **Search & Stream** | Search for any song and stream it instantly from YouTube — ابحث عن أي أغنية وشغلها فوراً |
| 📝 **Synced Lyrics** | Real-time synchronized lyrics that highlight as the song plays — كلمات متزامنة بتتحرك مع الأغنية |
| ❤️ **Like & Library** | Like songs and build your personal library — لايك للأغاني وبناء مكتبتك الشخصية |
| 📋 **Playlists** | Create, rename, and manage custom playlists — اعمل بلايلستات وظبطها زي ما تحب |
| ⬇️ **Offline Downloads** | Download songs as MP3 for offline listening — حمّل الأغاني MP3 عشان تسمعها من غير نت |
| ☁️ **Google Drive Sync** | Sync your library across all your PCs via Google Drive — زامن مكتبتك على كل أجهزتك |
| 📻 **Smart Radio** | Auto-play similar songs based on what you're listening to — راديو ذكي بيشغل أغاني شبه اللي بتسمعها |
| 🎯 **Daily Mixes** | Personalized daily mixes based on your taste — ميكسات يومية مخصصة ليك |
| 🔥 **Trending & New Releases** | Discover trending songs and new releases — اكتشف الأغاني الترند والإصدارات الجديدة |
| 🔄 **Auto Updates** | The app updates itself automatically — التطبيق بيحدّث نفسه أوتوماتيك |

---

## 🏗️ Architecture | البنية

```
nagham/
├── main.js              # Electron main process — window, IPC, download queue
├── preload.js           # Context bridge — secure API for the renderer
├── renderer/            # Frontend UI (HTML/CSS/JS)
│   ├── index.html       # Main app layout
│   ├── app.js           # UI logic — home, search, playlists, queue, player
│   ├── styles.css       # Spotify-inspired dark theme
│   ├── platform.js      # Platform abstraction layer
│   └── radio.js         # Radio/autoplay UI
├── src/                 # Backend modules
│   ├── ytdlp.js         # YouTube search, stream URLs, downloads (via yt-dlp)
│   ├── innertube.js     # YouTube Music API — trending, new releases
│   ├── server.js        # Local audio server with seeking support
│   ├── library.js       # Library stored in Google Drive folder
│   ├── lyrics.js        # Synced lyrics from LRCLIB
│   ├── algorithm.js     # Recommendation engine — daily mixes, autoplay
│   ├── audiocache.js    # Audio caching for instant playback
│   ├── pyworker.js      # Python worker for fast YouTube extraction
│   ├── tracks.js        # Track data helpers
│   ├── updates.js       # Auto-update via electron-updater
│   └── py/worker.py     # Python extraction worker
├── build/               # App icons
├── android/             # Android (Capacitor) wrapper
└── scripts/             # Build utilities
```

---

## 🚀 Quick Start | تشغيل سريع

### Prerequisites | المتطلبات
- [Node.js](https://nodejs.org/) (v18+)
- Windows 10/11

### Run from Source | تشغيل من السورس
```bash
# Clone the repo
git clone https://github.com/As3g-pos/negaafy.git
cd negaafy

# Install dependencies
npm install

# Run the app
npm start
```

### Run the Portable App | تشغيل التطبيق الجاهز
1. Download the latest release
2. Run `Negaafy.exe` from the extracted folder
3. Keep the whole `Negaafy` folder together (you can pin the exe to the taskbar)

---

## ☁️ Google Drive Sync | مزامنة جوجل درايف

1. Install [Google Drive for Desktop](https://www.google.com/drive/download/) and sign in
2. In Negaafy, go to **Settings → Library folder → Change…**
3. Choose a folder inside `My Drive` (e.g. `G:\My Drive\Negaafy`)

Your library file (`nagham-library.json`) and downloaded songs (`Songs/`) will sync to every PC.

---

## 🔧 How it Works | إزاي بيشتغل

| Module | What it does |
|--------|-------------|
| `src/ytdlp.js` | YouTube search, song radio, stream URLs, downloads via yt-dlp (auto-fetched on first run) |
| `src/innertube.js` | Direct YouTube Music API — trending, new releases, related content |
| `src/server.js` | Local HTTP audio server: serves downloaded files or proxies YouTube streams with seeking |
| `src/library.js` | Manages liked songs, playlists, history — stored in Google Drive folder |
| `src/lyrics.js` | Fetches synced lyrics (LRC) from LRCLIB.net — no API key needed |
| `src/algorithm.js` | Recommendation engine: analyzes listening history to generate daily mixes and autoplay |
| `src/audiocache.js` | Caches audio for instant playback and prefetching |
| `main.js` | Electron main process: window management, IPC handlers, download queue |
| `renderer/` | Full Spotify-style UI: search, playlists, queue, now-playing, synced lyrics view |

---

## 🛠️ Build | بناء التطبيق

```bash
# Build Windows installer (NSIS)
npm run dist

# Or build both portable + installer
npx electron-builder --win portable nsis
```

---

## 🐛 Troubleshooting | حل المشاكل

| Problem | Solution |
|---------|----------|
| Songs stop playing | YouTube changed something → **Settings → YouTube engine → Update** |
| Library not syncing | Make sure Google Drive for Desktop is running |
| App won't start | Delete `%AppData%/Nagham` folder and restart |

---

## 📄 License | الرخصة

This project is licensed under the **GPL-3.0** License.

---

<div align="center">

**Made with ❤️ by [ayato](https://github.com/As3g-pos)**

</div>
