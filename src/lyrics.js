// Song lyrics from LRCLIB (https://lrclib.net): free, no API key, and most entries are
// time-synced (LRC), which is what lets the UI highlight the line being sung.
const UA = 'Negaafy/1.0 (https://github.com/ayato2x/negaafy)';

async function get(path, params) {
  const res = await fetch(`https://lrclib.net/api/${path}?${new URLSearchParams(params)}`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`lyrics HTTP ${res.status}`);
  return res.json();
}

// The database has some junk entries ("[00:00.00]probe", every line at 0:00): require
// real text, and for synced lyrics, real timestamps.
function goodSynced(lrc) {
  if (!lrc) return false;
  const lines = lrc.split('\n').map((l) => l.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/)).filter((m) => m && m[3].trim());
  return lines.length >= 5 && new Set(lines.map((m) => m[1] + ':' + m[2])).size >= 5;
}
const goodPlain = (txt) => !!txt && txt.split('\n').filter((l) => l.trim()).length >= 4;

function pick(hit) {
  if (!hit) return null;
  const synced = goodSynced(hit.syncedLyrics) ? hit.syncedLyrics : null;
  const plain = goodPlain(hit.plainLyrics) ? hit.plainLyrics : null;
  return synced || plain ? { synced, plain } : null;
}

async function lyrics({ title, artist, duration }) {
  const exact = { track_name: title, artist_name: artist };
  if (duration) exact.duration = Math.round(duration);
  const hit = pick(await get('get', exact).catch(() => null));
  if (hit) return hit;
  // YouTube titles and channel names are noisy: fall back to a search, preferring
  // synced lyrics whose length matches the video.
  const near = (x) => !duration || !x.duration || Math.abs(x.duration - duration) < 10;
  for (const q of [`${title} ${artist}`, title]) {
    const list = (await get('search', { q })) || [];
    const best = list.find((x) => goodSynced(x.syncedLyrics) && near(x)) || list.find((x) => goodPlain(x.plainLyrics) && near(x));
    if (best) return pick(best);
  }
  return null;
}

module.exports = { lyrics };
