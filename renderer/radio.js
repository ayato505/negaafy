// Mood-keeping radio. Shared by the desktop and Android apps (pure functions, no I/O).
//
// A radio built from one song drifts: one odd song (a phonk track in a calm queue)
// pulls everything after it in its direction. Here the radio is built from the last
// few songs the listener actually finished, and a candidate ranks high only when the
// radios of several of those songs agree on it. Skips teach it what to avoid.

const W = [1, 0.8, 0.65]; // most recent seed counts most

export const artistKey = (a) => String(a || '').toLowerCase()
  .split(/\s*(?:&|,|\bfeat\.?|\bft\.?|\bx\b|،)\s*/)[0].trim();

// one entry per song, whatever the upload ("(Official Audio)", "Live", remasters...)
const songKey = (t) => artistKey(t.artist) + '|' + String(t.title || '').toLowerCase()
  .replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * lists:  radio results, one array per seed (lists[0] = most recent seed)
 * seeds:  the seed tracks themselves
 * taste:  { skips: {id: n}, skipArtists: {artistKey: n}, likedArtists: Set }
 * exclude: Set of ids that must not come back (queue, recent history)
 */
export function rankRadio(lists, { seeds = [], taste = {}, exclude = new Set(), limit = 25 } = {}) {
  const skips = taste.skips || {};
  const skipArtists = taste.skipArtists || {};
  const liked = taste.likedArtists || new Set();
  const seedArtists = new Set(seeds.map((s) => artistKey(s.artist)));
  const seedSongs = new Set(seeds.map(songKey));

  const cand = new Map();
  lists.forEach((list, li) => {
    const w = W[li] ?? 0.5;
    const seen = new Set();
    list.forEach((t, rank) => {
      if (!t || exclude.has(t.id) || skips[t.id] || seedSongs.has(songKey(t))) return;
      const k = songKey(t);
      if (seen.has(k)) return; // the same song twice in one radio counts once
      seen.add(k);
      const c = cand.get(k) || { t, score: 0, hits: 0, best: Infinity };
      c.score += w * (1 - rank / (list.length + 8));
      c.hits += 1;
      c.best = Math.min(c.best, rank / Math.max(1, list.length));
      cand.set(k, c);
    });
  });

  const multi = lists.filter((l) => l.length).length > 1;
  let out = [...cand.values()].map((c) => {
    const a = artistKey(c.t.artist);
    let s = c.score * (1 + 0.6 * (c.hits - 1)); // radios agreeing = same mood
    if (seedArtists.has(a)) s *= 1.2;
    if (liked.has(a)) s *= 1.15;
    if (skipArtists[a]) s *= Math.pow(0.5, skipArtists[a]);
    return { ...c, s, a };
  });

  // Songs only one seed suggests, from deep in its radio, are where the mood drifts.
  if (multi) {
    const agreed = out.filter((c) => c.hits > 1 || c.best < 0.4);
    if (agreed.length >= Math.min(limit, 12)) out = agreed;
  }

  out.sort((x, y) => y.s - x.s);

  // variety: at most 2 songs per artist, never the same artist twice in a row
  const perArtist = new Map();
  const picked = [];
  for (const c of out) {
    const n = perArtist.get(c.a) || 0;
    if (n >= 2) continue;
    perArtist.set(c.a, n + 1);
    picked.push(c);
    if (picked.length >= limit) break;
  }
  for (let i = 1; i < picked.length; i++) {
    if (picked[i].a === picked[i - 1].a) {
      const j = picked.findIndex((c, k) => k > i && c.a !== picked[i].a);
      if (j > 0) [picked[i], picked[j]] = [picked[j], picked[i]];
    }
  }
  return picked.map((c) => c.t);
}

// ---------------------------------------------------------------- taste memory
// Kept in the browser storage of each app: a skip within 30 s means "not this",
// a song played through means "more like this".

export function emptyTaste() {
  return { skips: {}, skipArtists: {}, done: [] };
}

export function recordSkip(taste, t) {
  taste.skips[t.id] = (taste.skips[t.id] || 0) + 1;
  const a = artistKey(t.artist);
  taste.skipArtists[a] = Math.min(4, (taste.skipArtists[a] || 0) + 1);
  // keep it small: forget the oldest skips
  const ids = Object.keys(taste.skips);
  if (ids.length > 400) for (const id of ids.slice(0, ids.length - 400)) delete taste.skips[id];
  return taste;
}

export function recordListen(taste, t) {
  const a = artistKey(t.artist);
  // listening to an artist through forgives earlier skips of them
  if (taste.skipArtists[a]) taste.skipArtists[a] = Math.max(0, taste.skipArtists[a] - 1) || undefined;
  taste.done = [{ id: t.id, title: t.title, artist: t.artist, duration: t.duration, thumb: t.thumb }, ...taste.done.filter((x) => x.id !== t.id)].slice(0, 20);
  return taste;
}
