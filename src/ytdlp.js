// Thin wrapper around the yt-dlp binary: stream URLs, downloads, links, and the
// fallback for search and song radio when YouTube's web API is unavailable.
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { toTrack, isSong } = require('./tracks');
const innertube = require('./innertube');

const RELEASE = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/';
const ENV = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };
const TAR = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');

// Runs at most `n` background jobs at once. Jobs share a key, so asking twice for the
// same song waits on one lookup. Urgent jobs (the song you just clicked) never wait.
class Slots {
  constructor(n) { this.n = n; this.queue = []; this.jobs = new Map(); }

  run(key, fn, urgent) {
    const job = this.jobs.get(key);
    if (job) {
      const i = this.queue.indexOf(job);
      if (urgent && i >= 0) { this.queue.splice(i, 1); this._start(job, false); }
      return job.promise;
    }
    const j = { key, fn };
    j.promise = new Promise((res, rej) => { j.res = res; j.rej = rej; });
    this.jobs.set(key, j);
    if (urgent) { this._start(j, false); return j.promise; }
    this.queue.push(j);
    while (this.queue.length > 8) {
      const old = this.queue.pop();
      this.jobs.delete(old.key);
      old.rej(new Error('dropped'));
    }
    this._pump();
    return j.promise;
  }

  _start(j, counted) {
    if (counted) this.n--;
    j.fn().then(j.res, j.rej).finally(() => {
      this.jobs.delete(j.key);
      if (counted) this.n++;
      this._pump();
    });
  }

  _pump() {
    while (this.n > 0 && this.queue.length) this._start(this.queue.shift(), true);
  }
}

function toStream(id, { url, headers, title, channel, duration }) {
  const exp = Number(new URL(url).searchParams.get('expire')) * 1000;
  return {
    url,
    headers: headers || {},
    expires: exp ? exp - 5 * 60000 : Date.now() + 3 * 3600000,
    track: toTrack({ id, title, channel, duration }),
  };
}

async function fetchTo(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(file));
}

class YtDlp {
  constructor(binDir, worker) {
    this.binDir = binDir;
    this.worker = worker;
    this.bin = null;
    this.ffmpeg = null;
    this.ready = null;
    this.slots = new Slots(3);
  }

  ensure(onStatus) {
    if (!this.ready) this.ready = this._ensure(onStatus).catch((e) => { this.ready = null; throw e; });
    return this.ready;
  }

  async _ensure(onStatus) {
    const dirExe = path.join(this.binDir, 'yt-dlp_win', 'yt-dlp.exe');
    const oneFile = path.join(this.binDir, 'yt-dlp.exe');
    if (!fs.existsSync(dirExe)) {
      onStatus?.('Downloading the YouTube engine (yt-dlp)… one time only');
      try { await this._installDir(); } catch {}
    }
    if (fs.existsSync(dirExe)) this.bin = dirExe; // the folder build starts ~2x faster
    else if (fs.existsSync(oneFile)) this.bin = oneFile;
    else if (await this._works('yt-dlp')) this.bin = 'yt-dlp';
    else {
      fs.mkdirSync(this.binDir, { recursive: true });
      await fetchTo(RELEASE + 'yt-dlp.exe', oneFile + '.part');
      fs.renameSync(oneFile + '.part', oneFile);
      this.bin = oneFile;
    }
    onStatus?.('');
    this.ffmpeg = await this._findFfmpeg();
    return this.bin;
  }

  // Fetch the latest yt-dlp folder build and swap it in.
  async _installDir() {
    fs.mkdirSync(this.binDir, { recursive: true });
    const zip = path.join(this.binDir, 'yt-dlp_win.zip');
    const fresh = path.join(this.binDir, 'yt-dlp_win.new');
    const live = path.join(this.binDir, 'yt-dlp_win');
    await fetchTo(RELEASE + 'yt-dlp_win.zip', zip);
    fs.rmSync(fresh, { recursive: true, force: true });
    fs.mkdirSync(fresh);
    await new Promise((r, j) => execFile(TAR, ['-xf', zip, '-C', fresh], { windowsHide: true }, (err) => (err ? j(err) : r())));
    // the zip may hold the files at its root or inside one folder
    const inner = fs.existsSync(path.join(fresh, 'yt-dlp.exe')) ? fresh : path.join(fresh, fs.readdirSync(fresh)[0]);
    if (!fs.existsSync(path.join(inner, 'yt-dlp.exe'))) throw new Error('unexpected yt-dlp archive layout');
    fs.rmSync(live + '.old', { recursive: true, force: true });
    if (fs.existsSync(live)) fs.renameSync(live, live + '.old');
    fs.renameSync(inner, live);
    for (const p of [live + '.old', fresh, zip]) fs.rmSync(p, { recursive: true, force: true });
  }

  _works(cmd) {
    return new Promise((r) => execFile(cmd, ['--version'], { windowsHide: true }, (err) => r(!err)));
  }

  _findFfmpeg() {
    return new Promise((r) => execFile('where', ['ffmpeg'], { windowsHide: true }, (err, out) => {
      const first = !err && out.split(/\r?\n/).find(Boolean);
      r(first ? path.dirname(first.trim()) : null);
    }));
  }

  async run(args, { onLine, timeout = 90000 } = {}) {
    await this.ensure();
    return new Promise((resolve, reject) => {
      const p = spawn(this.bin, args, { windowsHide: true, env: ENV });
      let out = '', err = '', buf = '';
      const timer = setTimeout(() => p.kill(), timeout);
      p.stdout.setEncoding('utf8');
      p.stderr.setEncoding('utf8');
      p.stdout.on('data', (d) => {
        out += d;
        if (!onLine) return;
        buf += d;
        const lines = buf.split(/\r?\n/);
        buf = lines.pop();
        lines.forEach(onLine);
      });
      p.stderr.on('data', (d) => { err += d; if (onLine) d.split(/\r?\n/).forEach((l) => onLine(l.trim())); });
      p.on('error', (e) => { clearTimeout(timer); reject(e); });
      p.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(out);
        else reject(new Error(err.trim().split('\n').pop() || `yt-dlp exited with ${code}`));
      });
    });
  }

  async json(args, opts) {
    return JSON.parse(await this.run([...args, '-J', '--no-warnings'], opts));
  }

  async search(query, limit = 25) {
    try { return await innertube.search(query); } catch {}
    const data = await this.json([`ytsearch${limit}:${query}`, '--flat-playlist']);
    return (data.entries || []).map(toTrack).filter(isSong);
  }

  // YouTube "Mix" playlist seeded by a video: the same idea as a song radio.
  async related(id, limit = 25) {
    try { return await innertube.mix(id); } catch {}
    const data = await this.json([`https://www.youtube.com/watch?v=${id}&list=RD${id}`,
      '--flat-playlist', '--playlist-end', String(limit + 1)]);
    return (data.entries || []).map(toTrack).filter((t) => t && t.id !== id);
  }

  // Any YouTube link: a single video or a playlist.
  async resolveUrl(url) {
    const data = await this.json([url, '--flat-playlist', '--playlist-end', '500']);
    if (data._type === 'playlist') {
      return { title: data.title || 'YouTube playlist', tracks: (data.entries || []).map(toTrack).filter(Boolean) };
    }
    const t = toTrack(data);
    return { title: t ? t.title : 'Song', tracks: t ? [t] : [] };
  }

  streamInfo(id, urgent = false, quality = 'best') {
    return this.slots.run(id + ':' + quality, async () => {
      if (this.worker) {
        try { return toStream(id, await this.worker.lookup(id, quality)); } catch {}
      }
      return this._streamInfo(id, quality);
    }, urgent);
  }

  async _streamInfo(id, quality = 'best') {
    const want = quality === 'low' ? 'worstaudio[ext=m4a]/worstaudio' : 'bestaudio[ext=m4a]/bestaudio';
    const info = await this.json(['-f', want, '--no-playlist',
      `https://www.youtube.com/watch?v=${id}`]);
    const fmt = info.requested_formats ? info.requested_formats[0] : info;
    return toStream(id, { url: fmt.url, headers: fmt.http_headers || info.http_headers, title: info.title, channel: info.channel || info.uploader, duration: info.duration });
  }

  async download(id, dir, format, onProgress) {
    await this.ensure();
    const args = ['--no-playlist', '--newline', '--no-warnings', '--no-mtime',
      '--progress-template', 'download:NAGHAM %(progress._percent_str)s',
      '-o', path.join(dir, '%(title).70B [%(id)s].%(ext)s')];
    if (this.ffmpeg) {
      args.push('--ffmpeg-location', this.ffmpeg, '-f', 'bestaudio', '-x',
        '--audio-format', format === 'm4a' ? 'm4a' : 'mp3', '--audio-quality', '0',
        '--embed-thumbnail', '--embed-metadata', '--convert-thumbnails', 'jpg');
    } else {
      args.push('-f', 'bestaudio[ext=m4a]/bestaudio');
    }
    args.push(`https://www.youtube.com/watch?v=${id}`);
    await this.run(args, {
      timeout: 15 * 60000,
      onLine: (line) => {
        const m = line.match(/NAGHAM\s+([\d.]+)%/);
        if (m) onProgress?.(Math.min(99, parseFloat(m[1])));
      },
    });
  }

  async version() {
    try { return (await this.run(['--version'])).trim(); } catch { return null; }
  }

  async update() {
    const before = await this.version();
    if (this.bin !== 'yt-dlp') {
      await this._installDir();
      this.bin = path.join(this.binDir, 'yt-dlp_win', 'yt-dlp.exe');
    }
    if (this.worker) { try { await this.worker.update(); } catch {} }
    const after = await this.version();
    return before === after ? `yt-dlp is up to date (${after})` : `Updated yt-dlp ${before} → ${after}`;
  }
}

module.exports = { YtDlp };
