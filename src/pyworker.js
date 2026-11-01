// Keeps one yt-dlp Python process alive (src/py/worker.py) so a song lookup costs
// ~1.5 s instead of ~4.5 s. Needs a regular Python 3 install; without one the app
// keeps using yt-dlp.exe for every lookup.
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCRIPT = path.join(__dirname, 'py', 'worker.py').replace('app.asar', 'app.asar.unpacked');
const run = (cmd, args, timeout = 300000) => new Promise((resolve, reject) =>
  execFile(cmd, args, { windowsHide: true, timeout }, (err, out) => (err ? reject(err) : resolve(out.trim()))));

// The Microsoft Store "python" redirects its file writes into a private folder, so prefer a real install.
async function findPython() {
  const local = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python');
  const candidates = [];
  try {
    for (const d of fs.readdirSync(local).sort().reverse()) candidates.push(path.join(local, d, 'python.exe'));
  } catch {}
  try { candidates.push(await run('py', ['-3', '-c', 'import sys; print(sys.executable)'], 10000)); } catch {}
  try {
    for (const p of (await run('where', ['python'], 10000)).split(/\r?\n/)) candidates.push(p.trim());
  } catch {}
  for (const p of candidates) {
    if (!p || /WindowsApps/i.test(p) || !fs.existsSync(p)) continue;
    try {
      const v = await run(p, ['-c', 'import sys; print(sys.version_info >= (3, 9))'], 10000);
      if (v === 'True') return p;
    } catch {}
  }
  return null;
}

class PyWorker {
  constructor(libDir) {
    this.libDir = libDir;
    this.proc = null;
    this.pending = new Map();
    this.rid = 0;
    this.starting = null;
    this.failures = 0;
  }

  get alive() { return !!(this.proc && this.ready); }

  start(onStatus) {
    if (!this.starting) {
      this.starting = this._start(onStatus).catch((e) => { this.starting = null; throw e; });
    }
    return this.starting;
  }

  async _start(onStatus) {
    this.python = this.python || (await findPython());
    if (!this.python) throw new Error('no Python 3 found');
    if (!fs.existsSync(path.join(this.libDir, 'yt_dlp'))) {
      onStatus?.('Setting up the fast YouTube engine… one time only');
      await this._pipInstall();
      onStatus?.('');
    }
    await this._spawn();
  }

  _pipInstall() {
    fs.mkdirSync(this.libDir, { recursive: true });
    return run(this.python, ['-m', 'pip', 'install', '--quiet', '--disable-pip-version-check', '--upgrade', '--target', this.libDir, 'yt-dlp']);
  }

  _spawn() {
    return new Promise((resolve, reject) => {
      const p = spawn(this.python, ['-u', '-X', 'utf8', SCRIPT], {
        windowsHide: true,
        env: { ...process.env, PYTHONPATH: this.libDir, PYTHONIOENCODING: 'utf-8' },
      });
      this.proc = p;
      this.ready = false;
      let buf = '';
      const timer = setTimeout(() => { p.kill(); reject(new Error('worker did not start')); }, 30000);
      p.stdout.setEncoding('utf8');
      p.stdout.on('data', (d) => {
        buf += d;
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          let msg;
          try { msg = JSON.parse(line); } catch { continue; }
          if (msg.ready) { clearTimeout(timer); this.ready = true; this.version = msg.version; this.failures = 0; resolve(); continue; }
          const job = this.pending.get(msg.rid);
          if (!job) continue;
          this.pending.delete(msg.rid);
          clearTimeout(job.timer);
          if (msg.ok) job.resolve(msg.info); else job.reject(new Error(msg.error));
        }
      });
      p.stderr.on('data', () => {});
      p.on('exit', () => {
        clearTimeout(timer);
        if (this.proc === p) { this.proc = null; this.ready = false; this.starting = null; }
        for (const job of this.pending.values()) { clearTimeout(job.timer); job.reject(new Error('worker exited')); }
        this.pending.clear();
        reject(new Error('worker exited'));
      });
    });
  }

  async lookup(id, quality = 'best') {
    if (!this.alive) {
      // never make a song wait for setup: start in the background, use yt-dlp.exe meanwhile
      if (this.failures <= 3) this.start().catch(() => { this.failures++; });
      throw new Error('worker not ready');
    }
    return new Promise((resolve, reject) => {
      const rid = ++this.rid;
      const timer = setTimeout(() => { this.pending.delete(rid); reject(new Error('lookup timed out')); }, 30000);
      this.pending.set(rid, { resolve, reject, timer });
      this.proc.stdin.write(JSON.stringify({ rid, id, q: quality }) + '\n');
    });
  }

  async update() {
    if (!this.python) return null;
    await this._pipInstall();
    if (this.proc) this.proc.kill();
    this.starting = null;
    await this.start();
    return this.version;
  }

  stop() { if (this.proc) this.proc.kill(); }
}

module.exports = { PyWorker };
