// The user's library lives inside the library folder (normally on Google Drive),
// so liked songs, playlists and downloaded files sync to every PC that runs Negaafy.
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const AUDIO = /\[([\w-]{11})\]\.(mp3|m4a|opus|webm|ogg|flac)$/i;

class Library extends EventEmitter {
  constructor(dir) {
    super();
    this.setDir(dir);
  }

  setDir(dir) {
    this.dir = dir;
    this.songsDir = path.join(dir, 'Songs');
    fs.mkdirSync(this.songsDir, { recursive: true });
    this.file = path.join(dir, 'nagham-library.json');
    this.load();
    this.scan();
  }

  load() {
    let d = {};
    try { d = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch {}
    this.data = {
      tracks: d.tracks || {},
      liked: d.liked || [],
      playlists: d.playlists || [],
      history: d.history || [],
    };
  }

  // Pick up files that were downloaded on another PC and synced over by Drive.
  scan() {
    const onDisk = new Map();
    for (const f of fs.readdirSync(this.songsDir)) {
      const m = f.match(AUDIO);
      if (m) onDisk.set(m[1], f);
    }
    for (const t of Object.values(this.data.tracks)) {
      if (t.file && !onDisk.has(t.id)) delete t.file;
    }
    for (const [id, f] of onDisk) {
      const t = this.data.tracks[id];
      if (t) t.file = f;
      else {
        this.data.tracks[id] = {
          id, file: f, addedAt: Date.now(), duration: 0,
          title: f.replace(AUDIO, '').trim(), artist: 'Downloaded',
          thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        };
      }
    }
    this.save();
  }

  save() {
    clearTimeout(this._t);
    this._t = setTimeout(() => {
      // The folder can disappear (Google Drive not running, folder deleted or moved).
      // Never crash for that: recreate it, and if writing still fails keep the library
      // in memory; the next change tries again.
      try {
        fs.mkdirSync(this.dir, { recursive: true });
        const tmp = this.file + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1));
        fs.renameSync(tmp, this.file);
      } catch (e) {
        this.emit('save-error', e);
      }
    }, 300);
  }

  changed() {
    this.save();
    this.emit('change', this.data);
  }

  upsert(t) {
    const cur = this.data.tracks[t.id] || { addedAt: Date.now() };
    const next = { ...cur, id: t.id, title: t.title, artist: t.artist, thumb: t.thumb };
    next.duration = t.duration || cur.duration || 0;
    this.data.tracks[t.id] = next;
    return next;
  }

  like(track, on) {
    this.upsert(track);
    this.data.liked = this.data.liked.filter((id) => id !== track.id);
    if (on) this.data.liked.unshift(track.id);
    this.changed();
  }

  history(track) {
    this.upsert(track);
    this.data.history = [track.id, ...this.data.history.filter((id) => id !== track.id)].slice(0, 100);
    this.changed();
  }

  createPlaylist(name, tracks = []) {
    tracks.forEach((t) => this.upsert(t));
    const pl = { id: 'pl' + Date.now().toString(36), name, tracks: tracks.map((t) => t.id), createdAt: Date.now() };
    this.data.playlists.unshift(pl);
    this.changed();
    return pl;
  }

  renamePlaylist(pid, name) {
    const pl = this.data.playlists.find((p) => p.id === pid);
    if (pl) { pl.name = name; this.changed(); }
  }

  deletePlaylist(pid) {
    this.data.playlists = this.data.playlists.filter((p) => p.id !== pid);
    this.changed();
  }

  addToPlaylist(pid, tracks) {
    const pl = this.data.playlists.find((p) => p.id === pid);
    if (!pl) return;
    for (const t of tracks) {
      this.upsert(t);
      if (!pl.tracks.includes(t.id)) pl.tracks.push(t.id);
    }
    this.changed();
  }

  removeFromPlaylist(pid, id) {
    const pl = this.data.playlists.find((p) => p.id === pid);
    if (pl) { pl.tracks = pl.tracks.filter((x) => x !== id); this.changed(); }
  }

  setFile(id, file) {
    const t = this.data.tracks[id];
    if (!t) return;
    if (file) t.file = file; else delete t.file;
    this.changed();
  }

  findDownloaded(id) {
    return fs.readdirSync(this.songsDir).find((f) => { const m = f.match(AUDIO); return m && m[1] === id; });
  }

  filePath(id) {
    const t = this.data.tracks[id];
    if (!t || !t.file) return null;
    const p = path.join(this.songsDir, t.file);
    return fs.existsSync(p) ? p : null;
  }

  deleteDownload(id) {
    const p = this.filePath(id);
    if (p) fs.rmSync(p, { force: true });
    this.setFile(id, null);
  }
}

module.exports = { Library };
