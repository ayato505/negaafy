const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { YtDlp } = require('./src/ytdlp');
const { Library } = require('./src/library');
const { startServer } = require('./src/server');
const { AudioCache } = require('./src/audiocache');
const { PyWorker } = require('./src/pyworker');
const { setupUpdates } = require('./src/updates');
const { lyrics } = require('./src/lyrics');
const innertube = require('./src/innertube');
const { RecommendationEngine } = require('./src/algorithm');

let win, yt, worker, lib, cache, port, updates, algo;
let settings = {};
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

// Google Drive for desktop mounts "My Drive" as a drive letter (G: by default).
function findGoogleDrive() {
  for (const letter of 'GHIJKLMNOPQRSTUVWXYZDEF') {
    for (const name of ['My Drive', 'ملفاتي', 'Mon Drive', 'Meine Ablage']) {
      const p = `${letter}:\\${name}`;
      try { if (fs.statSync(p).isDirectory()) return p; } catch {}
    }
  }
  return null;
}

function loadSettings() {
  try { settings = JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch { settings = {}; }
  const drive = findGoogleDrive();
  settings = {
    libraryDir: drive ? path.join(drive, 'Negaafy') : path.join(app.getPath('music'), 'Negaafy'),
    format: 'mp3',
    autoDownloadLiked: true,
    volume: 0.8,
    ...settings,
  };
}

function saveSettings() {
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 1));
}

const send = (ch, payload) => win && !win.isDestroyed() && win.webContents.send(ch, payload);

// ---------- stream URL cache ----------
const streams = new Map();
function resolve(id, { force = false, urgent = false } = {}) {
  const c = streams.get(id);
  if (c && !force && c.expires > Date.now()) return Promise.resolve(c);
  return yt.streamInfo(id, urgent, settings.mode === 'lite' ? 'low' : 'best').then((info) => { streams.set(id, info); return info; });
}

// ---------- downloads ----------
const dl = { queue: [], active: 0, state: {} };
function setDl(id, s) {
  if (s) dl.state[id] = s; else delete dl.state[id];
  send('dl:progress', { id, ...(s || { state: 'none' }) });
}
function enqueueDownload(track) {
  const s = dl.state[track.id];
  if (lib.filePath(track.id) || (s && s.state !== 'error')) return;
  lib.upsert(track);
  setDl(track.id, { state: 'queued', pct: 0 });
  dl.queue.push(track);
  pumpDownloads();
}
function pumpDownloads() {
  while (dl.active < 2 && dl.queue.length) {
    const t = dl.queue.shift();
    dl.active++;
    let last = 0;
    setDl(t.id, { state: 'downloading', pct: 0 });
    yt.download(t.id, lib.songsDir, settings.format, (pct) => {
      if (pct - last >= 2) { last = pct; setDl(t.id, { state: 'downloading', pct }); }
    }).then(() => {
      const f = lib.findDownloaded(t.id);
      if (!f) throw new Error('file not found after download');
      lib.setFile(t.id, f);
      setDl(t.id, null);
    }).catch((e) => {
      setDl(t.id, { state: 'error', pct: 0, error: e.message });
    }).finally(() => { dl.active--; pumpDownloads(); });
  }
}

// ---------- IPC ----------
function handlers() {
  const h = {
    init: async () => ({ port, settings, library: lib.data, downloads: dl.state, hasDrive: !!findGoogleDrive(), platform: 'desktop', update: updates.state }),
    appVersion: () => app.getVersion(),
    checkUpdate: () => updates.check(),
    installUpdate: () => updates.install(),
    search: (q) => yt.search(q),
    related: (id) => yt.related(id),
    lyrics: (track) => lyrics(track),
    resolveUrl: (url) => yt.resolveUrl(url),
    // fully download the next song in the background so it starts instantly
    prefetch: (id) => { if (!lib.filePath(id) && !cache.has(id)) cache.get(id, { urgent: false }); },
    // look up a song the user is likely to click (hovered row, top search result)
    warm: (id) => { if (!lib.filePath(id) && !cache.has(id)) resolve(id).catch(() => {}); },
    like: (track, on) => {
      lib.like(track, on);
      if (on && settings.autoDownloadLiked) enqueueDownload(track);
    },
    history: (track) => lib.history(track),
    createPlaylist: (name, tracks) => lib.createPlaylist(name, tracks),
    renamePlaylist: (pid, name) => lib.renamePlaylist(pid, name),
    deletePlaylist: (pid) => lib.deletePlaylist(pid),
    addToPlaylist: (pid, tracks) => lib.addToPlaylist(pid, tracks),
    removeFromPlaylist: (pid, id) => lib.removeFromPlaylist(pid, id),
    download: (tracks) => tracks.forEach(enqueueDownload),
    deleteDownload: (id) => lib.deleteDownload(id),
    setSettings: (patch) => {
      const dirChanged = patch.libraryDir && patch.libraryDir !== settings.libraryDir;
      Object.assign(settings, patch);
      saveSettings();
      if (dirChanged) { lib.setDir(settings.libraryDir); send('lib:changed', lib.data); }
      return settings;
    },
    pickFolder: async () => {
      const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], defaultPath: settings.libraryDir });
      return r.canceled ? null : r.filePaths[0];
    },
    ytdlpVersion: () => yt.version(),
    engineInfo: async () => ({ version: worker.version || (await yt.version()), fast: worker.alive }),
    ytdlpUpdate: () => yt.update(),
    openExternal: (url) => { if (/^https:\/\/(www\.)?youtube\.com\//.test(url)) shell.openExternal(url); },
    openLibraryFolder: () => shell.openPath(lib.dir),
    rescan: () => { lib.scan(); send('lib:changed', lib.data); },
    trending: () => innertube.trending(),
    newReleases: () => innertube.newReleases(),
    dailyMixes: () => algo.getDailyMixes(),
    resolveDailyMix: (mid) => algo.resolveDailyMix(mid),
    tasteProfile: () => algo.getTasteProfile(),
    autoplay: (id) => algo.getAutoplay(id),
  };
  for (const [name, fn] of Object.entries(h)) ipcMain.handle(name, (_e, ...args) => fn(...args));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1300,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#000000',
    title: 'Negaafy',
    icon: path.join(__dirname, 'build', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#000000', symbolColor: '#ffffff', height: 56 },
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

// The app was called Nagham before; keep its settings, engine and cache folder.
app.setPath('userData', path.join(app.getPath('appData'), 'Nagham'));

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  loadSettings();
  let libWarning = '';
  try {
    lib = new Library(settings.libraryDir);
  } catch {
    // e.g. the library is on Google Drive and Drive isn't running: open with a local
    // folder for now, without changing the setting, instead of failing to start
    lib = new Library(path.join(app.getPath('music'), 'Negaafy'));
    libWarning = `Library folder not available (${settings.libraryDir}). Using ${lib.dir} for now.`;
  }
  lib.on('change', (data) => send('lib:changed', data));
  lib.on('save-error', () => send('status', `Couldn't save the library to ${lib.dir}. It will retry.`));
  algo = new RecommendationEngine(innertube, lib);
  worker = new PyWorker(path.join(app.getPath('userData'), 'py'));
  yt = new YtDlp(path.join(app.getPath('userData'), 'bin'), worker);
  cache = new AudioCache(path.join(app.getPath('userData'), 'audio-cache'), resolve);
  port = await startServer({ cache, localFile: (id) => lib.filePath(id) });
  updates = setupUpdates((u) => send('update', u));
  handlers();
  createWindow();
  yt.ensure((msg) => send('status', msg)).then(() => send('status', ''))
    .catch((e) => send('status', 'Could not get yt-dlp: ' + e.message))
    .finally(() => worker.start((msg) => send('status', msg)).catch(() => send('status', '')))
    .finally(() => { if (libWarning) send('status', libWarning); });
});

app.on('window-all-closed', () => { worker.stop(); app.quit(); });
