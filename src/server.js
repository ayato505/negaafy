// Local audio server for the <audio> element. Downloaded songs and cached songs are
// read from disk; anything else is read from the audio cache while it downloads.
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = { '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.opus': 'audio/ogg', '.ogg': 'audio/ogg', '.webm': 'audio/webm', '.flac': 'audio/flac' };
const CORS = { 'Access-Control-Allow-Origin': '*', 'Accept-Ranges': 'bytes' };

function parseRange(header, size) {
  const m = (header || '').match(/bytes=(\d*)-(\d*)/);
  if (!m) return null;
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
  const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  return start <= end ? { start, end } : null;
}

function head(res, req, size, type) {
  const r = parseRange(req.headers.range, size);
  if (!r) {
    res.writeHead(200, { ...CORS, 'Content-Type': type, 'Content-Length': size });
    return { start: 0, end: size - 1 };
  }
  res.writeHead(206, { ...CORS, 'Content-Type': type, 'Content-Length': r.end - r.start + 1, 'Content-Range': `bytes ${r.start}-${r.end}/${size}` });
  return r;
}

function serveFile(file, req, res) {
  const size = fs.statSync(file).size;
  const { start, end } = head(res, req, size, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
  fs.createReadStream(file, { start, end }).pipe(res);
}

async function serveCache(e, req, res) {
  await e.ready;
  const { start, end } = head(res, req, e.size, e.type);
  let closed = false;
  res.on('close', () => { closed = true; });
  let pos = start;
  while (pos <= end && !closed) {
    await e.cacheWait(pos);
    if (e.error && e.have <= pos) return res.destroy();
    const stop = Math.min(e.have, end + 1);
    if (stop > pos) {
      const ok = res.write(e.buf.subarray(pos, stop));
      pos = stop;
      if (!ok && !closed) {
        await new Promise((r) => {
          const done = () => { res.off('drain', done); res.off('close', done); r(); };
          res.on('drain', done);
          res.on('close', done);
        });
      }
    }
  }
  res.end();
}

function startServer({ localFile, cache }) {
  const server = http.createServer(async (req, res) => {
    const m = req.url.match(/^\/stream\/([\w-]{11})/);
    if (!m) { res.writeHead(404).end(); return; }
    const id = m[1];
    try {
      const file = localFile(id) || cache.file(id);
      if (file) return serveFile(file, req, res);
      const e = cache.get(id);
      e.cacheWait = (pos) => cache.waitFor(e, pos);
      await serveCache(e, req, res);
    } catch (err) {
      if (!res.headersSent) res.writeHead(502, CORS);
      res.end(String(err.message || err));
    }
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port)));
}

module.exports = { startServer };
