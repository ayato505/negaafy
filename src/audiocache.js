// Spotify-style audio cache: the whole song is fetched at full speed as soon as it
// is requested (a few seconds), independent of playback, and kept on disk so it
// replays instantly. Playback reads from this buffer while it fills.
const fs = require('fs');
const path = require('path');

const CHUNK = 4 * 1024 * 1024; // YouTube throttles very large single requests
const IDLE_MS = 15000;
const EXT = { 'audio/mp4': '.m4a', 'audio/webm': '.webm' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class AudioCache {
  constructor(dir, resolve, { maxBytes = 1.5e9, keepInMemory = 4 } = {}) {
    this.dir = dir;
    this.resolve = resolve;
    this.maxBytes = maxBytes;
    this.keep = keepInMemory;
    this.mem = new Map();
    fs.mkdirSync(dir, { recursive: true });
  }

  file(id) {
    for (const ext of Object.values(EXT)) {
      const p = path.join(this.dir, id + ext);
      if (fs.existsSync(p)) {
        const now = new Date();
        try { fs.utimesSync(p, now, now); } catch {}
        return p;
      }
    }
    return null;
  }

  has(id) {
    const e = this.mem.get(id);
    return !!(e && !e.error) || !!this.file(id);
  }

  // urgent: the song is about to play; otherwise a background prefetch.
  get(id, { urgent = true } = {}) {
    let e = this.mem.get(id);
    if (e && !e.error) {
      if (urgent && !e.size) this.resolve(id, { urgent: true }).catch(() => {}); // promote a queued lookup
      this.mem.delete(id);
      this.mem.set(id, e); // most recently used
      return e;
    }
    e = { id, urgent, size: 0, have: 0, buf: null, type: 'audio/mp4', done: false, error: null, waiting: new Set() };
    e.ready = this._download(e);
    e.ready.catch(() => {});
    this.mem.set(id, e);
    this._trimMemory();
    return e;
  }

  waitFor(e, pos) {
    if (e.have > pos || e.done || e.error) return Promise.resolve();
    return new Promise((r) => e.waiting.add(r));
  }

  _notify(e) {
    const w = [...e.waiting];
    e.waiting.clear();
    w.forEach((f) => f());
  }

  _download(e) {
    return new Promise((ready, fail) => {
      let sized = false;
      (async () => {
        let attempts = 0;
        while (!e.done) {
          const ac = new AbortController();
          let idle;
          const kick = () => { clearTimeout(idle); idle = setTimeout(() => ac.abort(), IDLE_MS); };
          try {
            const info = await this.resolve(e.id, { force: attempts >= 2, urgent: e.urgent || attempts > 0 });
            const end = e.size ? Math.min(e.size - 1, e.have + CHUNK - 1) : CHUNK - 1;
            kick();
            const res = await fetch(info.url, { headers: { ...info.headers, Range: `bytes=${e.have}-${end}` }, signal: ac.signal });
            if (res.status !== 206 && res.status !== 200) { res.body?.cancel(); throw new Error(`HTTP ${res.status}`); }
            if (!sized) {
              const cr = res.headers.get('content-range');
              e.size = cr ? Number(cr.split('/')[1]) : Number(res.headers.get('content-length'));
              if (!e.size) throw new Error('unknown size');
              e.type = (res.headers.get('content-type') || 'audio/mp4').split(';')[0];
              e.buf = Buffer.allocUnsafe(e.size);
              sized = true;
              ready(e);
            }
            for await (const chunk of res.body) {
              kick();
              const n = Math.min(chunk.length, e.size - e.have);
              e.buf.set(chunk.subarray(0, n), e.have);
              e.have += n;
              this._notify(e);
            }
            attempts = 0;
            if (e.have >= e.size) {
              e.done = true;
              this._notify(e);
              this._persist(e);
            }
          } catch (err) {
            if (++attempts > 4) {
              e.error = err;
              this._notify(e);
              if (this.mem.get(e.id) === e) this.mem.delete(e.id);
              if (!sized) fail(err);
              return;
            }
            await sleep(300 * attempts);
          } finally {
            clearTimeout(idle);
          }
        }
      })();
    });
  }

  _persist(e) {
    const p = path.join(this.dir, e.id + (EXT[e.type] || '.m4a'));
    fs.writeFile(p + '.tmp', e.buf, (err) => {
      if (err) return;
      fs.rename(p + '.tmp', p, () => this._trimDisk());
    });
  }

  _trimMemory() {
    for (const [id, e] of this.mem) {
      if (this.mem.size <= this.keep) break;
      if (e.done || e.error) this.mem.delete(id);
    }
  }

  _trimDisk() {
    let files;
    try {
      files = fs.readdirSync(this.dir).filter((f) => !f.endsWith('.tmp')).map((f) => {
        const s = fs.statSync(path.join(this.dir, f));
        return { f, size: s.size, t: s.mtimeMs };
      });
    } catch { return; }
    let total = files.reduce((a, x) => a + x.size, 0);
    files.sort((a, b) => a.t - b.t);
    for (const x of files) {
      if (total <= this.maxBytes) break;
      try { fs.rmSync(path.join(this.dir, x.f)); total -= x.size; } catch {}
    }
  }
}

module.exports = { AudioCache };
