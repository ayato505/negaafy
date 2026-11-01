import { rankRadio, artistKey, emptyTaste, recordSkip, recordListen } from './radio.js';

const api = window.api;
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ---------------------------------------------------------------- icons
const P = {
  play: 'M7 4.5v15l13-7.5z',
  pause: 'M6 4h4.2v16H6zM13.8 4H18v16h-4.2z',
  next: 'M5 5l10 7-10 7zM16 5h3v14h-3z',
  prev: 'M19 5L9 12l10 7zM5 5h3v14H5z',
  heartFill: 'M12 20.5s-7.4-4.6-9.6-9.4A5.2 5.2 0 0 1 12 6.2a5.2 5.2 0 0 1 9.6 4.9c-2.2 4.8-9.6 9.4-9.6 9.4z',
  shuffle: 'M3 7h3.5c4.5 0 6.5 10 11 10H21M3 17h3.5c1.7 0 2.9-1.4 4-3.3M13.5 10.3C14.6 8.5 15.8 7 17.5 7H21M18 4l3 3-3 3M18 14l3 3-3 3',
  repeat: 'M4 11V9a3 3 0 0 1 3-3h13M17 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H4M7 21l-3-3 3-3',
  heart: 'M12 20.5s-7.4-4.6-9.6-9.4A5.2 5.2 0 0 1 12 6.2a5.2 5.2 0 0 1 9.6 4.9c-2.2 4.8-9.6 9.4-9.6 9.4z',
  home: 'M3.5 10.5L12 3.5l8.5 7V20.5h-5.5v-6h-6v6H3.5z',
  search: 'M10.5 3.5a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM15.8 15.8L21 21',
  library: 'M4.5 3.5v17M9.5 3.5v17M14 4.5l5.5 15.5',
  plus: 'M12 5v14M5 12h14',
  download: 'M12 2.8a9.2 9.2 0 1 0 0 18.4a9.2 9.2 0 1 0 0-18.4zM12 7.5v8M8.5 12.5L12 16l3.5-3.5',
  queue: 'M4 6h13M4 11h13M4 16h7M15 14.5v6l5-3z',
  volume: 'M3.5 9h3.5l5-4v14l-5-4H3.5zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11',
  volLow: 'M3.5 9h3.5l5-4v14l-5-4H3.5zM15.5 9a4 4 0 0 1 0 6',
  mute: 'M3.5 9h3.5l5-4v14l-5-4H3.5zM15.5 9.5l5 5M20.5 9.5l-5 5',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  chevL: 'M15 5l-7 7 7 7',
  chevR: 'M9 5l7 7-7 7',
  gear: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
  clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7v5l3 2',
  close: 'M6 6l12 12M18 6L6 18',
  note: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0a3 3 0 1 1 6 0zM20 16a3 3 0 1 1-6 0a3 3 0 1 1 6 0z',
  radio: 'M4.9 19.1a10 10 0 0 1 0-14.2M19.1 4.9a10 10 0 0 1 0 14.2M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  panel: 'M3 4h18v16H3zM14.5 4v16',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  folder: 'M3 6.5a1.5 1.5 0 0 1 1.5-1.5H10l2 2h7.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z',
  spinner: 'M12 3a9 9 0 1 0 9 9',
  back: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21',
};
const FILLED = new Set(['play', 'pause', 'next', 'prev', 'heartFill']);
function icon(name, cls = '') {
  if (name === 'dlDone') {
    return `<svg class="i ${cls}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M12 7v8M8.5 11.5L12 15l3.5-3.5" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  const d = P[name] || '';
  const sw = name === 'more' ? 3.2 : 2;
  return FILLED.has(name)
    ? `<svg class="i ${cls}" viewBox="0 0 24 24" fill="currentColor"><path d="${d}"/></svg>`
    : `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

// ---------------------------------------------------------------- state
const S = {
  port: 0, settings: {}, lib: { tracks: {}, liked: [], playlists: [], history: [] }, dl: {}, hasDrive: false,
  liked: new Set(),
  queue: [], qi: -1, manual: 0, orig: null, ctxKey: null,
  shuffle: store.get('shuffle', false), repeat: store.get('repeat', 'off'),
  playing: false, loading: false, retry: 0, resumeAt: 0,
  right: store.get('right', null), libFilter: null, platform: 'desktop', online: navigator.onLine, waitNet: null,
};
const audio = window.naghamAudio || $('#audio');
const TOUCH = matchMedia('(pointer: coarse)').matches;
const mobile = () => innerWidth <= 760;
const current = () => S.queue[S.qi];
const T = (id) => S.lib.tracks[id];
const isDownloaded = (id) => !!(T(id) && T(id).file);
const streamUrl = (id) => `http://127.0.0.1:${S.port}/stream/${id}`;
const songs = (n) => `${n} song${n === 1 ? '' : 's'}`;
// 320x180 thumbnails for small images; the 480x360 one only where it is shown large
const small = (u) => String(u || '').replace('/hqdefault.', '/mqdefault.');
const plain = (t) => ({ id: t.id, title: t.title, artist: t.artist, duration: t.duration, thumb: t.thumb });

function listTracks(key) {
  if (key === 'liked') return S.lib.liked.map(T).filter(Boolean);
  if (key === 'downloads') return Object.values(S.lib.tracks).filter((t) => t.file).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  const pl = S.lib.playlists.find((p) => p.id === key);
  return pl ? pl.tracks.map(T).filter(Boolean) : [];
}

// ---------------------------------------------------------------- toast / modal / menu
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function dialog({ title, value, input = true, ok = 'Save', text = '' }) {
  return new Promise((resolve) => {
    const m = $('#modal');
    m.innerHTML = `<div class="dialog"><h2>${esc(title)}</h2>${text ? `<p style="color:var(--sub)">${esc(text)}</p>` : ''}
      ${input ? `<input id="mIn" maxlength="100" value="${esc(value || '')}">` : ''}
      <div class="btns"><button class="pill dark" data-r="0">Cancel</button><button class="pill" data-r="1">${esc(ok)}</button></div></div>`;
    m.classList.remove('hidden');
    const inp = $('#mIn');
    const val = () => (input ? inp.value.trim() || null : true);
    const done = (v) => { m.classList.add('hidden'); m.innerHTML = ''; resolve(v); };
    if (inp) { inp.focus(); inp.select(); }
    m.onclick = (e) => {
      if (e.target === m) return done(null);
      const r = e.target.closest('[data-r]');
      if (r) done(r.dataset.r === '1' ? val() : null);
    };
    m.onkeydown = (e) => { if (e.key === 'Enter') done(val()); if (e.key === 'Escape') done(null); };
  });
}

const menu = $('#menu');
function showMenu(items, x, y) {
  menu.innerHTML = '';
  for (const it of items) {
    if (it === '-') { menu.append(el('<hr>')); continue; }
    const b = el(`<button class="${it.danger ? 'danger' : ''}">${icon(it.icon || 'note')}<span>${esc(it.label)}</span>${it.sub ? `<span style="margin-left:auto">${icon('chevR', 's16')}</span>` : ''}</button>`);
    b.onclick = (e) => {
      e.stopPropagation();
      if (it.sub) return showMenu(it.sub(), parseFloat(menu.style.left), parseFloat(menu.style.top));
      hideMenu();
      it.run();
    };
    menu.append(b);
  }
  menu.classList.toggle('sheet', mobile());
  menu.classList.remove('hidden');
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
  menu.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
}
const hideMenu = () => menu.classList.add('hidden');
document.addEventListener('click', (e) => { if (!menu.contains(e.target)) hideMenu(); });
document.addEventListener('contextmenu', (e) => { if (!e.defaultPrevented) hideMenu(); });
window.addEventListener('blur', hideMenu);

async function newPlaylist(tracks = []) {
  const name = await dialog({ title: 'Create playlist', value: `My Playlist #${S.lib.playlists.length + 1}`, ok: 'Create' });
  if (!name) return;
  const pl = await api.createPlaylist(name, tracks.map(plain));
  if (!S.lib.playlists.some((p) => p.id === pl.id)) S.lib.playlists.unshift(pl);
  go({ name: 'list', id: pl.id });
}

function playlistPicker(tracks) {
  return [
    { label: 'New playlist', icon: 'plus', run: () => newPlaylist(tracks) },
    ...(S.lib.playlists.length ? ['-'] : []),
    ...S.lib.playlists.map((p) => ({
      label: p.name, icon: 'note',
      run: () => { api.addToPlaylist(p.id, tracks.map(plain)); toast(`Added to ${p.name}`); },
    })),
  ];
}

function trackMenu(t, x, y, ctx = {}) {
  const liked = S.liked.has(t.id);
  const dlState = S.dl[t.id];
  showMenu([
    { label: 'Add to queue', icon: 'queue', run: () => addToQueue([t]) },
    { label: 'Go to song radio', icon: 'radio', run: () => openRadio(t) },
    '-',
    { label: 'Add to playlist', icon: 'plus', sub: () => playlistPicker([t]) },
    ...(ctx.pid ? [{ label: 'Remove from this playlist', icon: 'trash', run: () => api.removeFromPlaylist(ctx.pid, t.id) }] : []),
    { label: liked ? 'Remove from Liked Songs' : 'Save to Liked Songs', icon: liked ? 'heartFill' : 'heart', run: () => toggleLike(t) },
    isDownloaded(t.id)
      ? { label: 'Remove download', icon: 'trash', run: () => api.deleteDownload(t.id) }
      : { label: dlState && dlState.state !== 'error' ? 'Downloading…' : 'Download to library', icon: 'download', run: () => download([t]) },
    '-',
    { label: 'Search this artist', icon: 'search', run: () => searchFor(t.artist) },
    { label: 'Copy song link', icon: 'link', run: () => { navigator.clipboard.writeText(`https://youtu.be/${t.id}`); toast('Link copied'); } },
    { label: 'Open on YouTube', icon: 'external', run: () => api.openExternal(`https://www.youtube.com/watch?v=${t.id}`) },
  ], x, y);
}

function toggleLike(t) {
  const on = !S.liked.has(t.id);
  if (on) S.liked.add(t.id); else S.liked.delete(t.id);
  api.like(plain(t), on);
  toast(on ? (S.settings.autoDownloadLiked ? 'Added to Liked Songs · downloading' : 'Added to Liked Songs') : 'Removed from Liked Songs');
  updateHearts();
  if (on) {
    const cur = current() && current().id === t.id;
    $$(`.trow[data-id="${t.id}"] .hb${cur ? ', #npLeft .np-heart, #rightPanel [data-like]' : ''}`).forEach((b) => {
      b.classList.remove('pop');
      void b.offsetWidth;
      b.classList.add('pop');
    });
  }
}

function download(tracks) {
  const todo = tracks.filter((t) => !isDownloaded(t.id));
  if (!todo.length) return toast('Already downloaded');
  api.download(todo.map(plain));
  toast(todo.length === 1 ? 'Downloading…' : `Downloading ${todo.length} songs…`);
}

// ---------------------------------------------------------------- covers / colors
function coverHtml(key, cls = '') {
  if (key === 'liked') return `<div class="cover liked ${cls}">${icon('heartFill')}</div>`;
  if (key === 'downloads') return `<div class="cover downloads ${cls}">${icon('download')}</div>`;
  const tr = listTracks(key);
  const thumbs = [...new Set(tr.map((t) => t.thumb))];
  if (thumbs.length >= 4) return `<div class="cover mosaic ${cls}">${thumbs.slice(0, 4).map((u) => `<img decoding="async" src="${esc(small(u))}" alt="">`).join('')}</div>`;
  if (thumbs.length) return `<div class="cover ${cls}"><img decoding="async" src="${esc(cls.includes('big') ? thumbs[0] : small(thumbs[0]))}" alt=""></div>`;
  return `<div class="cover ${cls}">${icon('note')}</div>`;
}

function hueColor(seed, l = 32) {
  let h = 0;
  for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 45% ${l}%)`;
}

const colorCache = new Map();
// Full mode: animations, artwork colours, best audio. Lite mode saves data and battery:
// no effects, smaller pictures, lower audio quality, nothing loaded ahead of time.
const LITE = () => S.settings.mode === 'lite';
const DYNAMIC = () => !LITE() && (S.settings.theme || 'dynamic') === 'dynamic';

function imageColor(url) {
  if (!DYNAMIC()) return Promise.resolve(null); // fetching the picture again only to colour things
  if (colorCache.has(url)) return Promise.resolve(colorCache.get(url));
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 16;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 6, 120, 120, 0, 0, 16, 16);
        const d = g.getImageData(0, 0, 16, 16).data;
        let r = 0, gg = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          const max = Math.max(d[i], d[i + 1], d[i + 2]), min = Math.min(d[i], d[i + 1], d[i + 2]);
          const w = 1 + (max - min) / 32; // favor saturated pixels
          r += d[i] * w; gg += d[i + 1] * w; b += d[i + 2] * w; n += w;
        }
        const k = 0.75;
        const col = `rgb(${Math.round(r / n * k)} ${Math.round(gg / n * k)} ${Math.round(b / n * k)})`;
        colorCache.set(url, col);
        resolve(col);
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function paintBg(route, seed, thumb) {
  const bg = $('.view-bg');
  if (!bg) return;
  bg.style.background = `linear-gradient(${hueColor(seed)}, transparent)`;
  if (thumb) imageColor(thumb).then((c) => { if (c && R.cur === route && bg.isConnected) bg.style.background = `linear-gradient(${c}, transparent)`; });
}

// ---------------------------------------------------------------- router
const R = { stack: [], fwd: [], cur: null };
function go(route, { replace = false } = {}) {
  if (R.cur) R.cur.scroll = $('#view').scrollTop;
  if (R.cur && !replace) { R.stack.push(R.cur); R.fwd = []; }
  R.cur = route;
  render();
}
function back() { if (!R.stack.length) return; R.cur.scroll = $('#view').scrollTop; R.fwd.push(R.cur); R.cur = R.stack.pop(); render(); }
function fwd() { if (!R.fwd.length) return; R.cur.scroll = $('#view').scrollTop; R.stack.push(R.cur); R.cur = R.fwd.pop(); render(); }

let renderTimer;
const renderSoon = () => { clearTimeout(renderTimer); renderTimer = setTimeout(() => render(true), 120); };

// What each view shows from the library. A library change (a like, a play added to
// history, a finished download) re-renders the page only when this changes; hearts
// and download icons are updated in place instead, so nothing flickers or reloads.
function viewSig(route) {
  const L = S.lib;
  const pls = () => L.playlists.map((p) => p.id + ':' + p.name + ':' + p.tracks.length).join(',');
  switch (route.name) {
    case 'list': {
      const pl = L.playlists.find((p) => p.id === route.id);
      return (pl ? pl.name : route.id) + '|' + listTracks(route.id).map((t) => t.id + (t.file ? '+' : '')).join(',');
    }
    case 'library': return pls() + '|' + L.liked.length + '|' + listTracks('downloads').length;
    case 'home': return pls() + '|' + (listTracks('downloads').length > 0);
    default: return '';
  }
}
const libSig = () => S.lib.playlists.map((p) => p.id + ':' + p.name + ':' + p.tracks.length).join(',') + '|' + S.lib.liked.length + '|' + listTracks('downloads').length;

function render(keep = false) {
  const v = $('#view');
  const top = keep ? v.scrollTop : (R.cur.scroll || 0);
  v.innerHTML = '';
  VIEWS[R.cur.name](v, R.cur);
  R.cur.sig = viewSig(R.cur);
  v.scrollTop = top;
  if (!keep) { v.classList.remove('anim'); void v.offsetWidth; v.classList.add('anim'); }
  $('#backBtn').style.opacity = R.stack.length ? 1 : 0.4;
  $('#fwdBtn').style.opacity = R.fwd.length ? 1 : 0.4;
  if (R.cur.name !== 'search') { $('#q').value = ''; $('#clearQ').classList.add('hidden'); }
  renderLib();
  $$('#tabbar [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === (R.cur.name === 'list' ? 'library' : R.cur.name)));
  markPlaying();
}

function load(route, fn) {
  if (route.data || route.loading) return;
  route.loading = true;
  fn().then((d) => { route.data = d; }, (e) => { route.error = String(e.message || e).replace(/^Error invoking remote method '\w+': (Error: )?/, ''); })
    .finally(() => { route.loading = false; if (R.cur === route) render(true); });
}

// ---------------------------------------------------------------- shared pieces
function cardRow(tracks, ctxKey, shelf) {
  const row = el('<div class="row"></div>');
  if (shelf) row.dataset.shelf = shelf;
  if (tracks && (mobile() || LITE())) tracks = tracks.slice(0, LITE() ? 8 : 12); // a phone screen shows 2-3 at a time
  if (!tracks) {
    for (let i = 0; i < 7; i++) row.append(el('<div class="card skeleton"><div class="art"></div><div class="title" style="width:80%"></div><div class="sub" style="width:55%"></div></div>'));
    return row;
  }
  tracks.forEach((t, i) => {
    const c = el(`<div class="card" data-id="${t.id}"><div class="art"><img loading="lazy" decoding="async" src="${esc(LITE() ? small(t.thumb) : t.thumb)}" alt=""><span class="art-eq eq"><i></i><i></i><i></i></span><button class="fab">${icon('play')}</button></div>
      <div class="title">${esc(t.title)}</div><div class="sub">${esc(t.artist)}</div></div>`);
    c.onclick = () => (current() && current().id === t.id ? togglePlay() : playList(tracks, i, ctxKey));
    c.oncontextmenu = (e) => { e.preventDefault(); trackMenu(t, e.clientX, e.clientY); };
    row.append(c);
  });
  return row;
}

function mixRow(mixes) {
  const row = el('<div class="row"></div>');
  row.dataset.shelf = 'daily_mixes';
  if (!mixes || !mixes.length) {
    for (let i = 0; i < 3; i++) row.append(el('<div class="card skeleton"><div class="art"></div><div class="title" style="width:70%"></div><div class="sub" style="width:50%"></div></div>'));
    return row;
  }
  const gradients = [
    'linear-gradient(135deg, #1e3a8a, #065f46)',
    'linear-gradient(135deg, #831843, #581c87)',
    'linear-gradient(135deg, #7c2d12, #9a3412)',
    'linear-gradient(135deg, #134e4a, #1e40af)',
  ];
  const stripes = ['#10b981', '#ec4899', '#f97316', '#3b82f6'];
  mixes.forEach((m, idx) => {
    const grad = gradients[idx % gradients.length];
    const stripe = stripes[idx % stripes.length];
    const seedThumb = m.seedTracks && m.seedTracks[0] ? m.seedTracks[0].thumb : '';
    const c = el(`<div class="card" data-mix="${esc(m.id)}">
      <div class="art mix-art" style="background:${grad}">
        ${seedThumb ? `<img src="${esc(small(seedThumb))}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.35;mix-blend-mode:luminosity">` : ''}
        <div style="position:relative;z-index:2">
          <div class="mix-badge">DAILY MIX</div>
          <div class="mix-num">${idx + 1}</div>
        </div>
        <div class="mix-stripe" style="background:${stripe}"></div>
        <button class="fab">${icon('play')}</button>
      </div>
      <div class="title">${esc(m.title)}</div>
      <div class="sub">${esc(m.subtitle)}</div>
    </div>`);

    c.onclick = async (e) => {
      if (e.target.closest('.fab')) {
        toast(`Loading ${m.title}…`);
        const tracks = await api.resolveDailyMix(m.id);
        if (tracks && tracks.length) playList(tracks, 0, 'mix:' + m.id);
        return;
      }
      go({
        name: 'temp',
        kind: 'Daily Mix',
        title: m.title,
        key: 'mix:' + m.id,
        load: () => api.resolveDailyMix(m.id),
      });
    };
    row.append(c);
  });
  return row;
}

function section(title, small, body, more) {
  const s = el(`<section class="section"><div class="section-head"><h2>${small ? `<small>${esc(small)}</small>` : ''}${esc(title)}</h2></div></section>`);
  if (more) {
    const b = el('<button>Show all</button>');
    b.onclick = more;
    $('.section-head', s).append(b);
  }
  s.append(body);
  return s;
}

function dlIcon(id) {
  if (isDownloaded(id)) return `<button class="dlb done has" data-act="dl" title="Downloaded to your library">${icon('dlDone', 's16')}</button>`;
  const s = S.dl[id];
  if (s && s.state === 'error') return `<button class="dlb err has" data-act="dl" title="${esc('Download failed: ' + (s.error || '') + ' — click to retry')}">${icon('download', 's16')}</button>`;
  if (s) {
    const off = (50.27 * (1 - (s.pct || 0) / 100)).toFixed(1);
    return `<button class="dlb has" data-act="dl" title="${s.state === 'queued' ? 'Waiting to download' : `Downloading ${Math.round(s.pct)}%`}"><svg class="dl-ring" viewBox="0 0 20 20"><circle class="bg" cx="10" cy="10" r="8"/><circle class="fg" cx="10" cy="10" r="8" stroke-dasharray="50.27" stroke-dashoffset="${off}"/></svg></button>`;
  }
  return `<button class="dlb" data-act="dl" title="Download">${icon('download', 's16')}</button>`;
}

function ago(ts) {
  if (!ts) return '';
  const d = (Date.now() - ts) / 1000;
  if (d < 3600) return `${Math.max(1, Math.round(d / 60))} min ago`;
  if (d < 86400) return `${Math.round(d / 3600)} hours ago`;
  if (d < 86400 * 7) return `${Math.round(d / 86400)} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function trackTable(tracks, ctx) {
  const compact = !ctx.added;
  const wrap = el(`<div class="tracks ${compact ? 'compact' : ''}"><div class="thead"><div class="r">#</div><div>Title</div>${compact ? '' : '<div class="c-added">Date added</div>'}<div class="r">${icon('clock', 's16')}</div></div></div>`);
  const rows = tracks.map((t, i) => `<div class="trow${isDownloaded(t.id) ? ' local' : ''}" data-i="${i}" data-id="${t.id}">
      <div class="num"><span class="idx">${i + 1}</span><span class="eq"><i></i><i></i><i></i></span><button class="rowplay" data-act="play">${icon('play', 's16')}</button></div>
      <div class="t-main"><img loading="lazy" decoding="async" src="${esc(small(t.thumb))}" alt=""><div class="t-text"><div class="t-title">${esc(t.title)}</div><div class="t-artist">${esc(t.artist)}</div></div></div>
      ${compact ? '' : `<div class="t-added">${esc(ctx.added(t))}</div>`}
      <div class="t-end"><button class="hb ${S.liked.has(t.id) ? 'on' : ''}" data-act="like" title="Save to Liked Songs">${icon(S.liked.has(t.id) ? 'heartFill' : 'heart', 's16')}</button>
        <span data-dl="${t.id}">${dlIcon(t.id)}</span><span class="t-dur">${t.duration ? fmt(t.duration) : ''}</span>
        <button class="more" data-act="more" title="More options">${icon('more', 's16')}</button></div></div>`).join('');
  wrap.insertAdjacentHTML('beforeend', rows);
  const rowOf = (e) => e.target.closest('.trow');
  const play = (i) => {
    const t = tracks[i];
    if (current() && current().id === t.id && S.ctxKey === ctx.key) togglePlay();
    else playList(ctx.all || tracks, (ctx.all || tracks).indexOf(t), ctx.key);
  };
  wrap.onclick = (e) => {
    const r = rowOf(e);
    if (!r) return;
    const t = tracks[+r.dataset.i];
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'play') return play(+r.dataset.i);
    if (act === 'like') return toggleLike(t);
    if (act === 'dl') return isDownloaded(t.id) ? toast('Saved in your library folder') : download([t]);
    if (act === 'more') { const b = e.target.closest('button').getBoundingClientRect(); return trackMenu(t, b.left - 200, b.bottom + 4, ctx); }
    if (TOUCH) return play(+r.dataset.i);
    $$('.trow.sel', wrap).forEach((x) => x.classList.remove('sel'));
    r.classList.add('sel');
  };
  wrap.ondblclick = (e) => { const r = rowOf(e); if (r && !e.target.closest('[data-act]')) play(+r.dataset.i); };
  wrap.oncontextmenu = (e) => {
    const r = rowOf(e);
    if (!r) return;
    e.preventDefault();
    trackMenu(tracks[+r.dataset.i], e.clientX, e.clientY, ctx);
  };
  return wrap;
}

function skelRows(n) {
  const w = el('<div class="tracks compact skel-list"></div>');
  for (let i = 0; i < n; i++) {
    w.append(el(`<div class="trow"><div class="num"></div><div class="t-main"><div class="skel sq"></div><div class="t-text" style="flex:1"><div class="skel ln" style="width:${55 + (i * 17) % 35}%"></div><div class="skel ln sm" style="width:${30 + (i * 23) % 25}%"></div></div></div><div></div></div>`));
  }
  return w;
}

function emptyState(ic, title, text) {
  return el(`<div class="empty">${icon(ic)}<h2>${esc(title)}</h2><p>${esc(text)}</p></div>`);
}

// ---------------------------------------------------------------- offline
const NET_ERR = /resolve host|ENOTFOUND|EAI_AGAIN|getaddrinfo|network|timed? ?out|timeout|ECONN|UnknownHost|SocketTimeout|failed to fetch|unreachable|no address/i;
const isNetErr = (msg) => !S.online || NET_ERR.test(String(msg || ''));

function offlineScreen(title = "You're offline", text = 'Waiting for a connection… Songs you downloaded still play.') {
  const e = el(`<div class="offline-screen"><div class="radar"><span></span><span></span><span></span><img src="../build/icon.png" alt=""></div>
    <h2>${esc(title)}</h2><p>${esc(text)}</p>
    <div class="btns"><button class="pill" data-dls>Your downloads</button><button class="pill dark" data-retry>Try again</button></div></div>`);
  $('[data-dls]', e).onclick = () => go({ name: 'list', id: 'downloads' });
  $('[data-retry]', e).onclick = () => retryNow(true);
  return e;
}

function retryNow(manual) {
  S.online = navigator.onLine;
  document.body.classList.toggle('offline', !S.online);
  if (!S.online) { if (manual) toast('Still no connection'); return; }
  if (R.cur.error) { R.cur.error = null; R.cur.data = null; }
  render(true);
  if (S.waitNet) {
    const w = S.waitNet;
    S.waitNet = null;
    if (current() && current().id === w.id) loadCurrent(w.at);
  }
}

function setOnline(on) {
  if (on === S.online) return;
  S.online = on;
  document.body.classList.toggle('offline', !on);
  if (on) { toast('Back online'); retryNow(false); } else render(true);
}

// ---------------------------------------------------------------- views
const homeCache = store.get('homeCache', {});
function homeSection(key, loader) {
  const c = homeCache[key];
  if (c && Date.now() - c.t < 3 * 3600e3) return c.data;
  if (!homeSection.pending) homeSection.pending = {};
  if (!homeSection.pending[key]) {
    const slot = () => R.cur.name === 'home' && document.querySelector(`.row[data-shelf="${CSS.escape(key)}"]`);
    homeSection.pending[key] = loader().then((data) => {
      homeCache[key] = { t: Date.now(), data };
      store.set('homeCache', homeCache);
      const s = slot();
      if (s) {
        if (key === 'daily_mixes') {
          if (!data || !data.length) s.closest('.section')?.remove();
          else s.replaceWith(mixRow(data));
        } else {
          s.replaceWith(cardRow(data, key, key));
        }
      }
    }).catch(() => {
      const s = slot();
      if (s && !c) s.closest('.section')?.remove();
    }).finally(() => { delete homeSection.pending[key]; });
  }
  return c ? c.data : null;
}

const VIEWS = {
  home(v, route) {
    v.append(el('<div class="view-bg"></div>'));
    const page = el('<div class="page"></div>');
    const hr = new Date().getHours();
    page.append(el(`<h1 class="greet">${hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'}</h1>`));
    const hist = S.lib.history.map(T).filter(Boolean);

    const quick = el('<div class="quick"></div>');
    const qItems = [{ key: 'liked', name: 'Liked Songs' }];
    if (listTracks('downloads').length) qItems.push({ key: 'downloads', name: 'Downloads' });
    S.lib.playlists.slice(0, 4).forEach((p) => qItems.push({ key: p.id, name: p.name }));
    hist.slice(0, 8 - qItems.length).forEach((t) => qItems.push({ track: t, name: t.title }));
    for (const q of qItems) {
      const it = el(`<div class="quick-item">${q.track ? `<div class="cover"><img decoding="async" src="${esc(small(q.track.thumb))}" alt=""></div>` : coverHtml(q.key)}<div class="name">${esc(q.name)}</div><button class="mini-play">${icon('play')}</button></div>`);
      it.onclick = (e) => {
        if (q.track) return playList(hist, hist.indexOf(q.track), 'history');
        if (e.target.closest('.mini-play')) return playList(listTracks(q.key), 0, q.key);
        go({ name: 'list', id: q.key });
      };
      quick.append(it);
    }
    if (!S.online) {
      // like Spotify: say so up front, keep only what plays from this device
      page.append(offlineScreen("You're offline", 'New music shows up here when you are back online. Your downloads and liked songs saved on this device still play.'));
      page.append(quick);
      v.append(page);
      paintBg(route, 'offline');
      return;
    }
    page.append(quick);

    // 1. Made For You / Daily Mixes
    if (api.dailyMixes) {
      const daily = homeSection('daily_mixes', () => api.dailyMixes());
      if (daily && daily.length) {
        page.append(section('Made For You', 'Daily Mixes', mixRow(daily)));
      } else if (!homeCache['daily_mixes']) {
        page.append(section('Made For You', 'Daily Mixes', mixRow(null)));
      }
    }

    // 2. Real Trending Now (Charts from YouTube Music)
    const trend = homeSection('trend_real', () => (api.trending ? api.trending() : api.search('Top Music Hits 2026')));
    page.append(section('Trending now', 'Live charts', cardRow(trend, 'trend_real', 'trend_real'), () => searchFor('Trending Music Hits')));

    // 3. New Releases (Brand New Songs & Singles)
    const fresh = homeSection('new_releases', () => (api.newReleases ? api.newReleases() : api.search('New Arabic Songs 2026')));
    page.append(section('New releases', 'Fresh music', cardRow(fresh, 'new_releases', 'new_releases'), () => searchFor('New Releases')));

    // 4. Recently played
    if (hist.length) page.append(section('Recently played', null, cardRow(hist.slice(0, 14), 'history')));

    // 5. More like [Recent Seed]
    const seed = hist[0];
    if (seed) {
      const rel = homeSection('rel:' + seed.id, () => api.related(seed.id));
      page.append(section(`More like ${seed.title}`, 'Recommended for you', cardRow(rel, 'rel:' + seed.id, 'rel:' + seed.id), () => openRadio(seed)));
    }

    // 6. Because you listen to [Top Artist]
    const artistCounts = {};
    [...hist, ...listTracks('liked')].forEach((t) => {
      if (t.artist && t.artist !== 'Unknown artist') artistCounts[t.artist] = (artistCounts[t.artist] || 0) + 1;
    });
    const topArtist = Object.entries(artistCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (topArtist) {
      const artTracks = homeSection('art:' + topArtist, () => api.search(topArtist));
      page.append(section(`Because you listen to ${topArtist}`, 'For you', cardRow(artTracks, 'art:' + topArtist, 'art:' + topArtist), () => searchFor(topArtist)));
    }

    // 7. Curated shelves
    const allShelves = [
      ['arabic', 'Arabic hits', 'Popular', 'اغاني عربية جديدة 2026'],
      ['egypt', 'Egyptian favourites', 'Popular', 'اجمل اغاني مصرية'],
      ['chill', 'Chill vibes', 'Mood', 'chill songs playlist'],
      ['workout', 'Workout energy', 'Mood', 'workout music hits'],
    ];
    const shelves = LITE() ? allShelves.slice(0, 2) : allShelves;
    for (const [key, title, small, q] of shelves) {
      page.append(section(title, small, cardRow(homeSection(key, () => api.search(q)), key, key), () => searchFor(q)));
    }
    v.append(page);
    paintBg(route, seed ? seed.id : 'home', seed && seed.thumb);
  },

  search(v, route) {
    const page = el('<div class="page"></div>');
    v.append(page);
    const q = route.q || '';
    if (!q) {
      page.append(el('<h2 style="font-size:22px;margin:8px 0 18px">Browse all</h2>'));
      const tiles = el('<div class="tiles"></div>');
      const genres = [
        ['Arabic', '#e13300', 'اغاني عربية', '🎵'], ['Egyptian', '#8d67ab', 'اغاني مصرية', '🇪🇬'], ['Mahraganat', '#dc148c', 'مهرجانات', '🔊'],
        ['Pop', '#477d95', 'pop hits', '🎤'], ['Hip-Hop', '#bc5900', 'hip hop hits', '🎧'], ['Rock', '#e91429', 'rock classics', '🎸'],
        ['Chill', '#509bf5', 'chill music', '🌙'], ['Lo-fi', '#1e3264', 'lofi beats', '☕'], ['Workout', '#777777', 'workout music', '💪'],
        ['Classical', '#7d4b32', 'classical music best', '🎻'], ['Jazz', '#148a08', 'jazz classics', '🎷'], ['Anime', '#e8115b', 'anime openings', '✨'],
        ['Khaleeji', '#27856a', 'اغاني خليجية', '🌴'], ['Rap Arabi', '#503750', 'راب عربي', '🎙️'], ['Oldies', '#b49bc8', 'زمن الفن الجميل اغاني', '📻'],
        ['Focus', '#2d46b9', 'focus music study', '🧠'],
      ];
      for (const [name, color, gq, glyph] of genres) {
        const t = el(`<div class="tile" style="background:${color}">${esc(name)}<span class="glyph">${glyph}</span></div>`);
        t.onclick = () => searchFor(gq);
        tiles.append(t);
      }
      page.append(tiles);
      return;
    }
    const isUrl = /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//i.test(q);
    if (!S.online && !route.data) return page.append(offlineScreen("You're offline", 'Search needs an internet connection. Your downloads still play.'));
    load(route, () => (isUrl ? api.resolveUrl(q).then((d) => ({ link: d })) : api.search(q).then((tracks) => ({ tracks }))));
    if (route.error) {
      return page.append(isNetErr(route.error)
        ? offlineScreen("Can't reach YouTube", 'Check your internet connection and try again.')
        : emptyState('search', 'Something went wrong', route.error));
    }
    if (!route.data) {
      page.append(skelRows(8));
      return;
    }
    if (route.data.link) {
      const { title, tracks } = route.data.link;
      const temp = { name: 'temp', kind: 'YouTube link', title, data: tracks, key: 'link:' + q };
      go(temp, { replace: true });
      return;
    }
    const tracks = route.data.tracks;
    if (!tracks.length) return page.append(emptyState('search', `No results found for “${q}”`, 'Check the spelling, or try different keywords.'));
    const [top] = tracks;
    if (!LITE()) tracks.slice(0, 2).forEach((t) => api.warm(t.id));
    const ctxKey = 'search:' + q;
    const grid = el('<div class="search-top"></div>');
    const topEl = el(`<div><div class="section-head"><h2>Top result</h2></div><div class="top-result" data-id="${top.id}"><img src="${esc(top.thumb)}" alt=""><div class="title">${esc(top.title)}</div><div class="sub">${esc(top.artist)}<b>Song</b></div><button class="fab">${icon('play')}</button></div></div>`);
    $('.top-result', topEl).onclick = () => playList(tracks, 0, ctxKey);
    $('.top-result', topEl).oncontextmenu = (e) => { e.preventDefault(); trackMenu(top, e.clientX, e.clientY); };
    const songsBox = el('<div><div class="section-head"><h2>Songs</h2></div></div>');
    const mini = trackTable(tracks.slice(0, 4), { key: ctxKey, all: tracks });
    $('.thead', mini).remove();
    mini.style.padding = '0';
    songsBox.append(mini);
    grid.append(topEl, songsBox);
    page.append(grid);
    if (tracks.length > 4) {
      const all = trackTable(tracks, { key: ctxKey });
      all.style.padding = '0';
      page.append(section('All results', null, all));
    }
    const actions = el(`<div style="margin-top:24px;display:flex;gap:12px"><button class="pill dark">Save results as playlist</button><button class="pill dark">Play as radio</button></div>`);
    actions.children[0].onclick = () => newPlaylist(tracks);
    actions.children[1].onclick = () => openRadio(top);
    page.append(actions);
  },

  list(v, route) {
    const key = route.id;
    const pl = S.lib.playlists.find((p) => p.id === key);
    if (key !== 'liked' && key !== 'downloads' && !pl) return v.append(emptyState('note', 'Playlist not found', 'It may have been deleted.'));
    const tracks = listTracks(key);
    const name = key === 'liked' ? 'Liked Songs' : key === 'downloads' ? 'Downloads' : pl.name;
    const kind = key === 'downloads' ? 'Folder' : 'Playlist';
    const secs = tracks.reduce((a, t) => a + (t.duration || 0), 0);
    const meta = `<b>${songs(tracks.length)}</b>${secs ? `, about ${secs > 3600 ? `${Math.floor(secs / 3600)} hr ` : ''}${Math.round((secs % 3600) / 60)} min` : ''}`;
    renderListPage(v, route, {
      key, name, kind, meta, tracks,
      cover: coverHtml(key, 'big'),
      seed: key, thumb: tracks[0] && tracks[0].thumb,
      pid: pl && pl.id,
      added: (t) => ago(key === 'liked' || key === 'downloads' ? t.addedAt : t.addedAt),
      empty: key === 'liked'
        ? emptyState('heart', 'Songs you like will appear here', 'Save songs by tapping the heart icon. They are downloaded to your Drive automatically.')
        : key === 'downloads'
          ? emptyState('download', 'No downloads yet', 'Download songs and they will be saved in your library folder.')
          : emptyState('note', "Let's find something for your playlist", 'Search for songs, then use “Add to playlist” from the ⋯ menu.'),
    });
  },

  temp(v, route) {
    if (!S.online && !route.data) return v.append(offlineScreen());
    if (route.load) load(route, route.load);
    if (route.error) return v.append(isNetErr(route.error) ? offlineScreen("Can't reach YouTube", 'Check your internet connection and try again.') : emptyState('radio', 'Could not load', route.error));
    const tracks = route.data;
    renderListPage(v, route, {
      key: route.key, name: route.title, kind: route.kind,
      meta: tracks ? `<b>${songs(tracks.length)}</b>` : 'Loading…',
      tracks: tracks || [],
      cover: route.seed ? `<div class="cover radio"><img src="${esc(route.seed.thumb)}" alt="" style="opacity:.55;mix-blend-mode:luminosity"></div>` : `<div class="cover yt">${icon('play')}</div>`,
      seed: route.key, thumb: route.seed ? route.seed.thumb : tracks && tracks[0] && tracks[0].thumb,
      temp: true,
      loading: !tracks,
    });
  },

  library(v) {
    const page = el(`<div class="page"><div class="section-head"><h2 style="font-size:24px">Your Library</h2></div>
      <div class="chips" style="padding:0 0 12px"><button class="chip" data-filter="playlists">Playlists</button><button class="chip" data-filter="downloaded">Downloaded</button>
      <button class="chip" data-new>+ New playlist</button></div><div class="lib-list" style="padding:0"></div></div>`);
    $$('.chip[data-filter]', page).forEach((c) => (c.onclick = () => { S.libFilter = S.libFilter === c.dataset.filter ? null : c.dataset.filter; render(true); }));
    $('[data-new]', page).onclick = () => newPlaylist();
    v.append(page);
    renderLib($('.lib-list', page));
  },

  settings(v) {
    const st = S.settings;
    const android = S.platform === 'android';
    const driveOk = S.hasDrive && st.libraryDir && st.libraryDir.includes('Drive');
    const page = el(`<div class="page settings">
      <h1>Settings</h1>
      ${android ? `
      <h3>Library</h3>
      <div class="note">Liked songs, playlists and downloads are saved on this phone. Downloads are kept inside the app, so they play offline.</div>` : `
      <h3>Library &amp; Google Drive</h3>
      <div class="note ${driveOk ? 'ok' : 'warn'}">${S.hasDrive
        ? (driveOk ? 'Google Drive found. Your songs, liked songs and playlists are saved to your Drive and sync to any PC where you run Negaafy.' : 'Google Drive found, but your library folder is not inside it. Choose a folder inside “My Drive” to back everything up.')
        : 'Google Drive for desktop is not installed. Install it (free, from google.com/drive/download), sign in, then choose a folder inside “My Drive” here. Until then your library is saved on this PC.'}</div>
      <div class="set-row"><div class="l"><b>Library folder</b><span class="path">${esc(st.libraryDir)}</span></div>
        <div style="display:flex;gap:8px"><button class="btn-sm" id="openDir">Open</button><button class="btn-sm" id="pickDir">Change…</button></div></div>
      <div class="set-row"><div class="l"><b>Rescan library folder</b>Find songs that arrived from another PC through Drive</div><button class="btn-sm" id="rescan">Rescan</button></div>`}
      <h3>Downloads</h3>
      <div class="set-row"><div class="l"><b>Download liked songs automatically</b>Every song you like is saved for offline listening</div><button class="switch ${st.autoDownloadLiked ? 'on' : ''}" data-k="autoDownloadLiked"></button></div>
      ${android ? '' : `<div class="set-row"><div class="l"><b>Audio format</b>MP3 plays everywhere; M4A keeps the original quality</div>
        <select id="fmt"><option value="mp3">MP3 (best quality)</option><option value="m4a">M4A (AAC)</option></select></div>`}
      <h3>Playback</h3>
      <div class="set-row"><div class="l"><b>Autoplay</b>When your queue ends, keep playing similar songs</div><button class="switch ${st.autoplay !== false ? 'on' : ''}" data-k="autoplay"></button></div>
      <h3>Experience</h3>
      <div class="seg" id="modeSeg">
        <button data-mode="full"><b>Full</b><span>Animations, artwork colours and effects, best audio quality</span></button>
        <button data-mode="lite"><b>Lite</b><span>Saves data and battery: no effects, smaller pictures, lighter audio, nothing loaded ahead</span></button>
      </div>
      <h3>Appearance</h3>
      <div class="set-row"><div class="l"><b>Theme</b>Dynamic follows the colours of the song</div>
        <div class="seg small" id="themeSeg"><button data-theme="dynamic">Dynamic</button><button data-theme="dark">Dark</button><button data-theme="black">Black</button></div></div>
      <div class="set-row"><div class="l"><b>Accent colour</b></div><div class="swatches" id="sw"></div></div>
      <h3>YouTube engine</h3>
      <div class="set-row"><div class="l"><b>${android ? 'NewPipe Extractor' : 'yt-dlp'}</b><span id="ytv">checking…</span>${android ? '' : '<br>If songs stop playing, YouTube probably changed something. Updating usually fixes it.'}</div>${android ? '' : '<button class="btn-sm" id="ytUp">Update</button>'}</div>
      <h3>About &amp; updates</h3>
      <div class="set-row"><div class="l"><b>Negaafy <span id="appVer"></span></b><span id="updState">Updates are checked automatically.</span></div><button class="btn-sm" id="chkUp">Check for updates</button></div>
      ${android ? '' : `<h3>Keyboard</h3>
      <div class="note">Space: play / pause · Ctrl+→ / Ctrl+←: next / previous · Ctrl+L: search · Alt+←: back · Ctrl+↑/↓: volume</div>`}
      <p style="color:var(--muted);margin-top:32px">Negaafy · your personal music player · <a href="#" id="repoLink">GitHub</a></p>
    </div>`);
    v.append(page);
    const on = (sel, ev, fn) => { const x = $(sel, page); if (x) x[ev] = fn; };
    if ($('#fmt', page)) $('#fmt', page).value = st.format;
    on('#fmt', 'onchange', (e) => saveSettings({ format: e.target.value }));
    $$('.switch', page).forEach((b) => (b.onclick = () => { const v2 = !b.classList.contains('on'); b.classList.toggle('on', v2); saveSettings({ [b.dataset.k]: v2 }); }));
    on('#openDir', 'onclick', () => api.openLibraryFolder());
    on('#rescan', 'onclick', () => { api.rescan(); toast('Library rescanned'); });
    on('#pickDir', 'onclick', async () => {
      const dir = await api.pickFolder();
      if (!dir) return;
      S.settings = await api.setSettings({ libraryDir: dir });
      toast('Library folder changed');
      render(true);
    });
    on('#repoLink', 'onclick', (e) => { e.preventDefault(); api.openExternal('https://github.com/ayato2x/negaafy'); });
    const mode = st.mode === 'lite' ? 'lite' : 'full';
    $$('#modeSeg [data-mode]', page).forEach((b) => {
      b.classList.toggle('on', b.dataset.mode === mode);
      b.onclick = async () => {
        await saveSettings({ mode: b.dataset.mode });
        applyAppearance();
        toast(b.dataset.mode === 'lite' ? 'Lite mode on: saving data and battery' : 'Full mode on');
        render(true);
      };
    });
    $$('#themeSeg [data-theme]', page).forEach((b) => {
      b.classList.toggle('on', b.dataset.theme === (st.theme || 'dynamic'));
      b.disabled = mode === 'lite';
      b.onclick = async () => { await saveSettings({ theme: b.dataset.theme }); applyAppearance(); renderNowPlaying(); render(true); };
    });
    const accents = ['#22d36b', '#1fb6ff', '#a970ff', '#ff6b9a', '#ff9f1c', '#f5d90a', '#ff4d4d'];
    for (const a of accents) {
      const b = el(`<button class="swatch ${st.accent === a || (!st.accent && a === accents[0]) ? 'on' : ''}" style="background:${a}"></button>`);
      b.onclick = () => { saveSettings({ accent: a }); applyAccent(); render(true); };
      $('#sw', page).append(b);
    }
    api.engineInfo().then((x) => {
      const e = $('#ytv');
      if (e) e.textContent = android ? `Version ${x.version}` : `Version ${x.version || '…'} · ${x.fast ? 'fast engine on' : 'fast engine off (install Python 3 from python.org to speed up song loading)'}`;
    });
    api.appVersion().then((ver) => { const e = $('#appVer'); if (e) e.textContent = ver; });
    on('#ytUp', 'onclick', async (e) => {
      e.target.textContent = 'Updating…';
      try { toast(await api.ytdlpUpdate()); } catch (err) { toast('Update failed: ' + err.message); }
      e.target.textContent = 'Update';
      render(true);
    });
    on('#chkUp', 'onclick', async (e) => {
      e.target.textContent = 'Checking…';
      const st2 = $('#updState');
      try {
        const r = await api.checkUpdate();
        if (st2) st2.textContent = r && r.version ? `Version ${r.version} is available.` : 'You have the latest version.';
      } catch (err) {
        if (st2) st2.textContent = 'Could not check: ' + String(err.message || err).replace(/^Error invoking remote method '\w+': (Error: )?/, '');
      }
      e.target.textContent = 'Check for updates';
    });
  },
};

function renderListPage(v, route, o) {
  v.append(el('<div class="view-bg" style="height:520px"></div>'));
  const hero = el(`<div class="hero">${o.cover}<div style="min-width:0"><div class="kind">${esc(o.kind)}</div><h1>${esc(o.name)}</h1><div class="meta">${o.meta}</div></div></div>`);
  if (o.pid) {
    $('h1', hero).style.cursor = 'pointer';
    $('h1', hero).onclick = () => renamePlaylist(o.pid);
  }
  v.append(hero);
  const body = el('<div class="content-bg"></div>');
  const acts = el('<div class="actions"></div>');
  const fab = el(`<button class="fab lg" data-ctxfab="${esc(o.key)}" title="Play">${icon(S.ctxKey === o.key && S.playing ? 'pause' : 'play')}</button>`);
  fab.onclick = () => {
    if (!o.tracks.length) return;
    if (S.ctxKey === o.key && current()) togglePlay(); else playList(o.tracks, 0, o.key);
  };
  const shuf = el(`<button class="ctl ${S.shuffle ? 'on' : ''}" title="Shuffle">${icon('shuffle')}</button>`);
  shuf.onclick = () => { if (!S.shuffle) toggleShuffle(); if (o.tracks.length) playList(o.tracks, Math.floor(Math.random() * o.tracks.length), o.key); shuf.classList.add('on'); };
  acts.append(fab, shuf);
  if (o.temp) {
    const save = el(`<button class="ctl" title="Save to Your Library">${icon('plus')}</button>`);
    save.onclick = async () => {
      if (!o.tracks.length) return;
      const pl = await api.createPlaylist(o.name, o.tracks.map(plain));
      toast(`Saved “${o.name}” to Your Library`);
      if (!S.lib.playlists.some((p) => p.id === pl.id)) S.lib.playlists.unshift(pl);
      renderLib();
    };
    acts.append(save);
  }
  if (o.key !== 'downloads') {
    const done = o.tracks.length && o.tracks.every((t) => isDownloaded(t.id));
    const dlb = el(`<button class="ctl ${done ? 'on' : ''}" title="${done ? 'Downloaded' : 'Download all to your library'}">${icon(done ? 'dlDone' : 'download')}</button>`);
    dlb.onclick = () => download(o.tracks);
    acts.append(dlb);
  } else {
    const ob = el(`<button class="ctl" title="Open folder">${icon('folder')}</button>`);
    ob.onclick = () => api.openLibraryFolder();
    acts.append(ob);
  }
  if (o.pid) {
    const more = el(`<button class="ctl" title="More options">${icon('more')}</button>`);
    more.onclick = (e) => {
      const b = e.currentTarget.getBoundingClientRect();
      showMenu(playlistMenu(o.pid), b.left, b.bottom + 6);
    };
    acts.append(more);
  }
  body.append(acts);
  if (o.loading) body.append(cardRow(null));
  else if (!o.tracks.length && o.empty) body.append(o.empty);
  else body.append(trackTable(o.tracks, { key: o.key, pid: o.pid, added: o.added }));
  v.append(body);
  paintBg(route, o.seed, o.thumb);
}

function playlistMenu(pid) {
  const pl = S.lib.playlists.find((p) => p.id === pid);
  return [
    { label: 'Add to queue', icon: 'queue', run: () => addToQueue(listTracks(pid)) },
    { label: 'Download all', icon: 'download', run: () => download(listTracks(pid)) },
    { label: 'Rename', icon: 'edit', run: () => renamePlaylist(pid) },
    '-',
    { label: 'Delete', icon: 'trash', danger: true, run: async () => {
      if (!(await dialog({ title: 'Delete from Your Library?', text: `This will delete “${pl.name}”. Downloaded songs stay in your folder.`, input: false, ok: 'Delete' }))) return;
      api.deletePlaylist(pid);
      if (R.cur.id === pid) go({ name: 'home' }, { replace: true });
    } },
  ];
}

async function renamePlaylist(pid) {
  const pl = S.lib.playlists.find((p) => p.id === pid);
  const name = await dialog({ title: 'Edit details', value: pl.name });
  if (name) api.renamePlaylist(pid, name);
}

function openRadio(t) {
  go({ name: 'temp', kind: 'Song radio', title: `${t.title} Radio`, key: 'radio:' + t.id, seed: t, load: () => api.related(t.id).then((r) => [plain(t), ...r]) });
}

function searchFor(q) {
  $('#q').value = q;
  $('#clearQ').classList.remove('hidden');
  if (R.cur && R.cur.name === 'search') go({ name: 'search', q }, { replace: true });
  else go({ name: 'search', q });
  $('#q').value = q;
  $('#clearQ').classList.toggle('hidden', !q);
}

// ---------------------------------------------------------------- left library
function renderLib(list = $('#libList')) {
  const f = S.libFilter;
  $$('.chips .chip').forEach((c) => c.classList.toggle('on', c.dataset.filter === f));
  const items = [];
  if (f !== 'downloaded') items.push({ key: 'liked', name: 'Liked Songs', sub: `Playlist • ${songs(S.lib.liked.length)}` });
  const dlCount = listTracks('downloads').length;
  if (f !== 'playlists') items.push({ key: 'downloads', name: 'Downloads', sub: `Folder • ${songs(dlCount)}` });
  for (const p of S.lib.playlists) {
    const tr = listTracks(p.id);
    if (f === 'downloaded' && !(tr.length && tr.every((t) => t.file))) continue;
    items.push({ key: p.id, name: p.name, sub: `Playlist • ${songs(tr.length)}`, pid: p.id });
  }
  list.innerHTML = '';
  for (const it of items) {
    const active = R.cur && R.cur.name === 'list' && R.cur.id === it.key;
    const row = el(`<div class="lib-item ${active ? 'active' : ''} ${S.ctxKey === it.key ? 'playing' : ''}">${coverHtml(it.key)}<div class="meta"><div class="name">${esc(it.name)}</div><div class="sub">${esc(it.sub)}</div></div></div>`);
    row.onclick = () => go({ name: 'list', id: it.key });
    row.ondblclick = () => playList(listTracks(it.key), 0, it.key);
    row.oncontextmenu = (e) => {
      e.preventDefault();
      if (it.pid) showMenu(playlistMenu(it.pid), e.clientX, e.clientY);
      else showMenu([{ label: 'Play', icon: 'play', run: () => playList(listTracks(it.key), 0, it.key) }, { label: 'Add to queue', icon: 'queue', run: () => addToQueue(listTracks(it.key)) }], e.clientX, e.clientY);
    };
    list.append(row);
  }
}

// ---------------------------------------------------------------- player
function playList(tracks, i = 0, ctxKey = null) {
  if (!tracks || !tracks.length) return;
  S.queue = tracks.map(plain);
  S.qi = Math.max(0, Math.min(i, tracks.length - 1));
  S.manual = 0;
  S.orig = null;
  S.ctxKey = ctxKey;
  S.anchor = S.queue[S.qi]; // the song the listener chose: autoplay stays near its mood
  S.autoSkips = 0;
  if (S.shuffle) shuffleRest();
  loadCurrent();
  renderLib();
}

function shuffleRest() {
  S.orig = S.queue.slice();
  const cur = S.queue[S.qi];
  const rest = S.queue.filter((_, j) => j !== S.qi);
  for (let j = rest.length - 1; j > 0; j--) { const k = Math.floor(Math.random() * (j + 1)); [rest[j], rest[k]] = [rest[k], rest[j]]; }
  S.queue = [cur, ...rest];
  S.qi = 0;
}

function toggleShuffle() {
  S.shuffle = !S.shuffle;
  store.set('shuffle', S.shuffle);
  if (S.queue.length) {
    if (S.shuffle) shuffleRest();
    else if (S.orig) {
      const cur = current();
      S.queue = S.orig;
      S.orig = null;
      S.qi = Math.max(0, S.queue.findIndex((t) => t.id === cur.id));
    }
  }
  syncControls();
  renderRight();
  saveQueue();
}

function cycleRepeat() {
  S.repeat = S.repeat === 'off' ? 'all' : S.repeat === 'all' ? 'one' : 'off';
  store.set('repeat', S.repeat);
  syncControls();
}

function addToQueue(tracks) {
  if (!tracks.length) return;
  if (!S.queue.length) return playList(tracks, 0);
  S.queue.splice(S.qi + 1 + S.manual, 0, ...tracks.map(plain));
  S.manual += tracks.length;
  toast(tracks.length === 1 ? 'Added to queue' : `Added ${tracks.length} songs to queue`);
  renderRight();
  saveQueue();
}

function loadCurrent(startAt = 0) {
  const t = current();
  if (!t) return;
  S.loading = true;
  S.retry = 0;
  audio.src = streamUrl(t.id);
  if (startAt) audio.addEventListener('loadedmetadata', () => { audio.currentTime = startAt; }, { once: true });
  audio.play().catch(() => {});
  watchStall();
  api.history(t);
  const nx = S.queue[S.qi + 1];
  if (nx && !LITE()) api.prefetch(nx.id);
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: 'Negaafy', artwork: [{ src: t.thumb, sizes: '480x360', type: 'image/jpeg' }] });
  }
  document.title = `${t.title} • ${t.artist}`;
  renderNowPlaying();
  syncControls();
  renderRight();
  markPlaying();
  saveQueue();
}

function togglePlay() {
  if (!current()) {
    const liked = listTracks('liked');
    if (liked.length) playList(liked, 0, 'liked');
    return;
  }
  if (!audio.src) return loadCurrent(S.resumeAt);
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
}

// What the listener skips and plays through (see radio.js). Kept on this device.
const taste = Object.assign(emptyTaste(), store.get('taste', {}));
const saveTaste = () => store.set('taste', taste);
const tasteNow = () => ({ ...taste, likedArtists: new Set(S.lib.liked.map(T).filter(Boolean).map((t) => artistKey(t.artist))) });

// Autoplay: radio of the song just played *and* of the song the listener chose, ranked
// so songs both agree on come first. Measured over 2.5 h sessions this kept the mood
// 56% similar to the chosen song, against 32% for the last song's radio alone.
async function moreLikeThis(limit) {
  const seeds = [current(), S.anchor].filter(Boolean).filter((s, i, a) => a.findIndex((x) => x.id === s.id) === i);
  const lists = await Promise.all(seeds.map((s) => api.related(s.id).catch(() => [])));
  const exclude = new Set([...S.queue.map((t) => t.id), ...S.lib.history.slice(0, 60)]);
  return rankRadio(lists, { seeds, taste: tasteNow(), exclude, limit }).map((t) => ({ ...plain(t), auto: true }));
}

// Two autoplay picks skipped in a row: the mix is off, so rebuild what is left of it.
async function refillAuto() {
  const cut = S.qi + 1 + S.manual;
  const keep = [...S.queue.slice(0, cut), ...S.queue.slice(cut).filter((t) => !t.auto)];
  const fresh = await moreLikeThis(15).catch(() => []);
  if (!fresh.length) return;
  S.queue = [...keep, ...fresh];
  toast('Got it, adjusting your mix');
}

async function next(auto = false) {
  if (!current()) return;
  if (auto && S.repeat === 'one') { audio.currentTime = 0; audio.play(); return; }
  const cur = current();
  if (auto) {
    recordListen(taste, cur);
    saveTaste();
    S.autoSkips = 0;
  } else if (audio.currentTime < 30 && dur() > 60) {
    recordSkip(taste, cur);
    saveTaste();
    if (cur.auto && ++S.autoSkips >= 2) {
      S.autoSkips = 0;
      S.loading = true;
      syncControls();
      await refillAuto();
    }
  }
  if (S.manual > 0) S.manual--;
  if (!S.online) {
    // offline: jump to the next song that is saved on this device
    const j = S.queue.findIndex((t, k) => k > S.qi && isDownloaded(t.id));
    if (j > 0) { S.qi = j; return loadCurrent(); }
  }
  if (S.qi + 1 < S.queue.length) { S.qi++; return loadCurrent(); }
  if (S.repeat === 'all') { S.qi = 0; return loadCurrent(); }
  if (S.settings.autoplay === false) { audio.pause(); audio.currentTime = 0; return; }
  toast('Autoplay: finding similar songs…');
  S.loading = true;
  syncControls();
  try {
    const more = await moreLikeThis(15);
    if (!more.length) throw new Error('none');
    S.queue.push(...more);
    S.qi++;
    loadCurrent();
  } catch {
    S.loading = false;
    syncControls();
  }
}

function prev() {
  if (audio.currentTime > 3 || S.qi <= 0) { audio.currentTime = 0; return; }
  S.qi--;
  loadCurrent();
}

function saveQueue() {
  store.set('queue', { queue: S.queue.slice(Math.max(0, S.qi - 50), S.qi + 200), qi: Math.min(S.qi, 50), ctxKey: S.ctxKey, time: audio.currentTime || 0 });
}
setInterval(() => { if (S.playing) saveQueue(); }, 5000);

// Stall watchdog: if playback waits on data for too long, reconnect at the same spot.
let stallTimer;
function watchStall() {
  clearTimeout(stallTimer);
  stallTimer = setTimeout(() => {
    const t = current();
    if (!t || !S.loading || audio.paused && !S.playing) return;
    const at = audio.currentTime;
    audio.src = streamUrl(t.id) + '?r=' + Date.now();
    audio.addEventListener('loadedmetadata', () => { audio.currentTime = at; }, { once: true });
    audio.play().catch(() => {});
    watchStall();
  }, 10000);
}
audio.addEventListener('playing', () => { clearTimeout(stallTimer); S.loading = false; S.playing = true; syncControls(); });
audio.addEventListener('pause', () => { S.playing = false; syncControls(); saveQueue(); });
audio.addEventListener('waiting', () => { S.loading = true; syncControls(); watchStall(); });
audio.addEventListener('canplay', () => { S.loading = false; syncControls(); });
audio.addEventListener('ended', () => next(true));
audio.addEventListener('timeupdate', updateProgress);
audio.addEventListener('durationchange', updateProgress);
audio.addEventListener('error', () => {
  const t = current();
  if (!t || !audio.src) return;
  if (!isDownloaded(t.id) && isNetErr(audio.error && audio.error.message)) {
    S.waitNet = { id: t.id, at: audio.currentTime };
    S.loading = true;
    syncControls();
    toast('No connection: the song continues when you are back online');
    return;
  }
  if (S.retry++ < 1) { const at = audio.currentTime; audio.src = streamUrl(t.id) + '?r=' + Date.now(); if (at) audio.currentTime = at; audio.play().catch(() => {}); return; }
  S.loading = false;
  syncControls();
  toast(`Couldn't play “${t.title}”. Skipping…`);
  setTimeout(() => { if (current() === t) next(); }, 1500);
});

const seek = $('#seek');
let seeking = false;
function dur() { return Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (current() && current().duration) || 0; }
function fill(input) { input.style.setProperty('--p', `${(input.value - input.min) / (input.max - input.min) * 100}%`); }
function updateProgress() {
  if (seeking) return;
  const d = dur();
  seek.value = d ? (audio.currentTime / d) * 1000 : 0;
  fill(seek);
  $('#tCur').textContent = fmt(audio.currentTime);
  $('#tDur').textContent = fmt(d);
  syncLyrics(false);
  if ('mediaSession' in navigator && d && navigator.mediaSession.setPositionState) {
    try { navigator.mediaSession.setPositionState({ duration: d, position: Math.min(audio.currentTime, d), playbackRate: 1 }); } catch {}
  }
}
seek.addEventListener('input', () => { seeking = true; fill(seek); $('#tCur').textContent = fmt((seek.value / 1000) * dur()); });
seek.addEventListener('change', () => {
  seeking = false;
  if (!audio.src && current()) { S.resumeAt = (seek.value / 1000) * dur(); return loadCurrent(S.resumeAt); }
  audio.currentTime = (seek.value / 1000) * dur();
});

const vol = $('#vol');
let volTimer, lastVol = S.settings.volume;
function setVolume(v, persist = true) {
  v = Math.max(0, Math.min(1, v));
  audio.volume = v * v; // perceptual curve
  vol.value = Math.round(v * 100);
  fill(vol);
  $('#muteBtn').innerHTML = icon(v === 0 ? 'mute' : v < 0.5 ? 'volLow' : 'volume');
  if (persist) { clearTimeout(volTimer); volTimer = setTimeout(() => saveSettings({ volume: v }), 400); }
}
vol.addEventListener('input', () => setVolume(vol.value / 100));
$('#muteBtn').onclick = () => {
  const v = vol.value / 100;
  if (v > 0) { lastVol = v; setVolume(0); } else setVolume(lastVol || 0.7);
};

function syncControls() {
  const pb = $('#playBtn');
  pb.classList.toggle('loading', S.loading && !!current());
  const pbIcon = S.loading && current() ? 'spinner' : S.playing ? 'pause' : 'play';
  if (pb.dataset.ic !== pbIcon) { pb.dataset.ic = pbIcon; pb.innerHTML = icon(pbIcon); }
  pb.title = S.playing ? 'Pause' : 'Play';
  document.body.classList.toggle('is-playing', S.playing);
  $('#shuffleBtn').classList.toggle('on', S.shuffle);
  const rb = $('#repeatBtn');
  rb.classList.toggle('on', S.repeat !== 'off');
  rb.innerHTML = icon('repeat') + (S.repeat === 'one' ? '<span class="badge">1</span>' : '');
  rb.title = S.repeat === 'off' ? 'Enable repeat' : S.repeat === 'all' ? 'Enable repeat one' : 'Disable repeat';
  // touch only the buttons whose icon actually changes
  const swap = (b, name, cls) => { if (b && b.dataset.ic !== name) { b.dataset.ic = name; b.innerHTML = icon(name, cls); } };
  $$('[data-ctxfab]').forEach((b) => swap(b, S.ctxKey === b.dataset.ctxfab && S.playing ? 'pause' : 'play'));
  const curId = current() && current().id;
  $$('.trow').forEach((r) => swap($('.rowplay', r), r.dataset.id === curId && S.playing ? 'pause' : 'play', 's16'));
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = S.playing ? 'playing' : 'paused';
}

function markPlaying() {
  const id = current() && current().id;
  $$('.trow').forEach((r) => r.classList.toggle('playing', r.dataset.id === id));
  $$('.card').forEach((c) => c.classList.toggle('playing', c.dataset.id === id && S.playing));
  syncControls();
}

function renderNowPlaying() {
  const t = current();
  const box = $('#npLeft');
  $('.player').classList.toggle('empty', !t);
  if (!t) { box.innerHTML = ''; return; }
  imageColor(t.thumb).then((c) => {
    if (current() !== t) return;
    document.documentElement.style.setProperty('--np-color', c || hueColor(t.id, 26));
  });
  const liked = S.liked.has(t.id);
  box.innerHTML = `<img src="${esc(small(t.thumb))}" alt="" title="Now playing view"><div class="t-text"><div class="t-title">${esc(t.title)}</div><div class="t-artist">${esc(t.artist)}</div></div>
    <button class="ctl np-heart ${liked ? 'on' : ''}" title="${liked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}">${icon(liked ? 'heartFill' : 'heart', 's16')}</button>
    <span data-dl="${t.id}" class="t-end" style="gap:0">${dlIcon(t.id)}</span>`;
  $('img', box).onclick = () => setRight(S.right === 'now' ? null : 'now');
  if (mobile()) box.onclick = (e) => { if (!e.target.closest('button, [data-dl]')) setRight('now'); };
  $('.t-title', box).onclick = () => (mobile() ? null : S.ctxKey && (S.ctxKey === 'liked' || S.ctxKey === 'downloads' || S.ctxKey.startsWith('pl')) ? go({ name: 'list', id: S.ctxKey }) : openRadio(t));
  $('.t-artist', box).onclick = () => searchFor(t.artist);
  $('.np-heart', box).onclick = () => toggleLike(t);
  $('[data-dl]', box).onclick = () => (isDownloaded(t.id) ? toast('Saved in your library folder') : download([t]));
  box.oncontextmenu = (e) => { e.preventDefault(); trackMenu(t, e.clientX, e.clientY - 300); };
}

function setHeart(b, on, cls) {
  if (!b || b.classList.contains('on') === on) return;
  b.classList.toggle('on', on);
  b.innerHTML = icon(on ? 'heartFill' : 'heart', cls);
}

function updateHearts() {
  $$('.trow').forEach((r) => setHeart($('.hb', r), S.liked.has(r.dataset.id), 's16'));
  const t = current();
  if (!t) return;
  const on = S.liked.has(t.id);
  setHeart($('#npLeft .np-heart'), on, 's16');
  setHeart($('#rightPanel [data-like]'), on, '');
}

// ---------------------------------------------------------------- lyrics
// Synced lyrics (LRC) highlight the line being sung, like Spotify; plain lyrics just show.
const lyricsCache = new Map();
const lyricsWait = new Map();
const lyricsStore = store.get('lyrics', {});

function parseLrc(lrc) {
  const out = [];
  for (const raw of lrc.split('\n')) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of stamps) out.push({ t: Number(m[1]) * 60 + Number(m[2]), text });
  }
  return out.sort((a, b) => a.t - b.t);
}

function getLyrics(t) {
  if (lyricsCache.has(t.id)) return Promise.resolve(lyricsCache.get(t.id));
  if (!lyricsWait.has(t.id)) {
    const saved = lyricsStore[t.id];
    const p = (saved !== undefined ? Promise.resolve(saved) : api.lyrics(plain(t)).then((r) => {
      lyricsStore[t.id] = r || null;
      const keys = Object.keys(lyricsStore);
      if (keys.length > 60) delete lyricsStore[keys[0]];
      store.set('lyrics', lyricsStore);
      return r;
    })).then((r) => {
      const v = r ? { lines: r.synced ? parseLrc(r.synced) : null, plain: r.plain || null } : null;
      lyricsCache.set(t.id, v);
      return v;
    }).catch(() => undefined) // no connection: try again next time
      .finally(() => lyricsWait.delete(t.id));
    lyricsWait.set(t.id, p);
  }
  return lyricsWait.get(t.id);
}

function lyricIndex(lines, time) {
  let lo = 0, hi = lines.length - 1, at = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= time + 0.25) { at = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return at;
}

const lyr = { idx: -2, userScroll: 0 };
function lyricLine(l, i) {
  return `<p class="lyr" data-i="${i}" data-t="${l.t}">${l.text ? esc(l.text) : '♪'}</p>`;
}

// Fill the lyrics card (now playing) or the full lyrics view once the lyrics arrive.
function fillLyrics(p, t) {
  const card = $('[data-lyrcard]', p);
  const full = $('.lyr-lines', p);
  if (!card && !full) return;
  lyr.idx = -2;
  getLyrics(t).then((v) => {
    if (current() !== t || !p.contains(card || full)) return;
    if (v === undefined) {
      if (card) card.remove();
      if (full) full.innerHTML = '<p class="lyr-none">Lyrics need an internet connection.</p>';
      return;
    }
    if (!v) {
      if (card) card.remove();
      if (full) full.innerHTML = '<p class="lyr-none">No lyrics found for this song.</p>';
      return;
    }
    if (card) {
      card.classList.remove('loading');
      $('.lyr-preview', card).innerHTML = v.lines ? v.lines.slice(0, 5).map(lyricLine).join('')
        : v.plain.split('\n').filter((x) => x.trim()).slice(0, 5).map((x) => `<p class="lyr">${esc(x)}</p>`).join('');
    }
    if (full) {
      full.innerHTML = v.lines ? v.lines.map(lyricLine).join('')
        : `<p class="lyr-note">These lyrics aren't synced to the song.</p>${v.plain.split('\n').map((x) => `<p class="lyr plain">${esc(x) || '&nbsp;'}</p>`).join('')}`;
    }
    syncLyrics(true);
  });
}

// Called on every time update: move the highlight, keep the current line in view.
function syncLyrics(force) {
  const t = current();
  const v = t && lyricsCache.get(t.id);
  if (!v || !v.lines) return;
  const p = $('#rightPanel');
  const card = $('[data-lyrcard] .lyr-preview', p);
  const full = $('.lyr-lines', p);
  if (!card && !full) return;
  const i = lyricIndex(v.lines, audio.currentTime);
  if (i === lyr.idx && !force) return;
  lyr.idx = i;
  if (card) {
    const from = Math.max(0, Math.min(i, v.lines.length - 5));
    card.innerHTML = v.lines.slice(from, from + 5).map((l, k) => lyricLine(l, from + k)).join('');
    card.querySelectorAll('.lyr').forEach((e) => e.classList.toggle('on', +e.dataset.i === i));
  }
  if (full) {
    full.querySelectorAll('.lyr').forEach((e) => {
      const k = +e.dataset.i;
      e.classList.toggle('on', k === i);
      e.classList.toggle('done', k < i);
    });
    const on = full.querySelector('.lyr.on');
    const box = full.closest('.rp-body');
    if (on && box && Date.now() - lyr.userScroll > 3500) {
      box.scrollTo({ top: on.offsetTop - box.clientHeight * 0.38, behavior: LITE() || force ? 'auto' : 'smooth' });
    }
  }
}

// ---------------------------------------------------------------- right panel
function setRight(mode) {
  S.right = mode;
  store.set('right', mode);
  renderRight();
}

let sheetTimer;
function renderRight() {
  const p = $('#rightPanel');
  $('#queueBtn').classList.toggle('on', S.right === 'queue');
  $('#nowViewBtn').classList.toggle('on', S.right === 'now');
  $('#lyricsBtn').classList.toggle('on', S.right === 'lyrics');
  p.classList.toggle('lyrics-mode', S.right === 'lyrics');
  clearTimeout(sheetTimer);
  if (mobile()) {
    if (!S.right) {
      p.classList.remove('open');
      if (document.body.classList.contains('np-open')) document.body.classList.add('np-closing');
      sheetTimer = setTimeout(() => { document.body.classList.remove('np-open', 'np-closing'); p.classList.add('hidden'); }, 320);
      return;
    }
    const opening = p.classList.contains('hidden') || !p.classList.contains('open');
    p.classList.remove('hidden');
    document.body.classList.remove('np-closing');
    document.body.classList.add('np-open');
    if (opening) { void p.offsetWidth; p.classList.add('open'); } // flush the closed position so the slide animates
  } else {
    document.body.classList.remove('np-open');
    p.classList.remove('open');
    if (!S.right) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
  }
  const t = current();
  const qItem = (x, i, now) => `<div class="q-item ${now ? 'now' : ''}" data-qi="${i}"><img loading="lazy" decoding="async" src="${esc(small(x.thumb))}" alt=""><div class="t-text"><div class="t-title">${esc(x.title)}</div><div class="t-artist">${esc(x.artist)}</div></div>${now ? '' : `<button class="x" data-rm="${i}" title="Remove from queue">${icon('close', 's16')}</button>`}</div>`;
  if (S.right === 'queue') {
    const upNext = S.queue.slice(S.qi + 1);
    p.innerHTML = `<div class="rp-head"><span>Queue</span><button class="circle small ghost" data-close>${icon('close')}</button></div>
      <div class="rp-body">${t ? `<div class="q-label">Now playing</div>${qItem(t, S.qi, true)}` : '<p style="color:var(--sub)">Nothing playing yet.</p>'}
      ${upNext.length ? `<div class="q-label">Next up</div>${upNext.slice(0, 150).map((x, j) => qItem(x, S.qi + 1 + j)).join('')}` : ''}
      ${t && !upNext.length ? `<p style="color:var(--sub);margin-top:16px">${S.settings.autoplay === false ? 'Queue is empty.' : 'Autoplay will continue with similar songs.'}</p>` : ''}</div>`;
  } else if (S.right === 'lyrics') {
    p.innerHTML = `<div class="rp-head"><span>Lyrics</span><button class="circle small ghost" data-close>${icon('close')}</button></div>
      <div class="rp-body lyr-body">${t ? `<div class="lyr-head"><img src="${esc(small(t.thumb))}" alt=""><div class="t-text"><div class="t-title">${esc(t.title)}</div><div class="t-artist">${esc(t.artist)}</div></div></div>
        <div class="lyr-lines"><div class="skel ln"></div><div class="skel ln" style="width:70%"></div><div class="skel ln" style="width:85%"></div></div>
        <p class="lyr-src">Lyrics from LRCLIB</p>` : '<p style="color:var(--sub)">Play something to see its lyrics.</p>'}</div>`;
    const body = $('.lyr-body', p);
    const mark = () => { lyr.userScroll = Date.now(); };
    body.addEventListener('wheel', mark, { passive: true });
    body.addEventListener('touchmove', mark, { passive: true });
  } else {
    if (!t) { p.innerHTML = `<div class="rp-head"><span>Now playing</span><button class="circle small ghost" data-close>${icon('close')}</button></div><div class="rp-body"><p style="color:var(--sub)">Play something to see it here.</p></div>`; }
    else {
      const nx = S.queue[S.qi + 1];
      const liked = S.liked.has(t.id);
      p.innerHTML = `<div class="rp-head"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.artist)}</span><button class="circle small ghost" data-close>${icon('close')}</button></div>
        <div class="rp-ambient" style="background-image:url('${esc(small(t.thumb))}')"></div>
        <div class="rp-body"><img class="rp-art" src="${esc(LITE() ? t.thumb : t.thumb.replace('hqdefault', 'maxresdefault'))}" alt="">
        <div class="rp-title"><div style="min-width:0"><div class="n">${esc(t.title)}</div><div class="a">${esc(t.artist)}</div></div>
          <button class="ctl np-heart ${liked ? 'on' : ''}" data-like>${icon(liked ? 'heartFill' : 'heart')}</button></div>
        <div class="rp-card lyr-card loading" data-lyrcard><h3><span>Lyrics</span><button data-openlyr>Show lyrics</button></h3>
          <div class="lyr-preview"><div class="skel ln"></div><div class="skel ln" style="width:75%"></div><div class="skel ln" style="width:60%"></div></div></div>
        ${nx ? `<div class="rp-card"><h3><span>Next in queue</span><button data-openq>Open queue</button></h3>${qItem(nx, S.qi + 1, false)}</div>` : ''}
        <div class="rp-card"><h3><span>About this song</span></h3>
          <p style="color:var(--sub);margin:0 0 12px">${isDownloaded(t.id) ? 'Saved in your library folder — plays offline.' : 'Streaming from YouTube.'}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-sm" data-radio>Song radio</button><button class="btn-sm" data-yt>Open on YouTube</button>${isDownloaded(t.id) ? '' : '<button class="btn-sm" data-dlnow>Download</button>'}</div></div></div>`;
    }
  }
  if (t) fillLyrics(p, t);
  const title = $('.rp-title .n', p);
  if (title && !LITE() && title.scrollWidth > title.clientWidth + 4) {
    // long titles scroll sideways, like Spotify
    title.classList.add('marquee');
    title.innerHTML = `<span>${esc(t.title)}</span><span aria-hidden="true">${esc(t.title)}</span>`;
  }
  const art = $('.rp-art', p);
  if (art) {
    // YouTube answers a missing maxres image with a 120x90 placeholder rather than an error
    const fallback = () => { if (!art.dataset.fb) { art.dataset.fb = 1; art.src = t.thumb; } };
    art.addEventListener('error', fallback);
    art.addEventListener('load', () => { if (art.naturalWidth <= 120) fallback(); });
  }
  p.onclick = (e) => {
    if (e.target.closest('[data-close]')) return setRight(null);
    if (e.target.closest('[data-openq]')) return setRight('queue');
    if (e.target.closest('[data-openlyr], [data-lyrcard]')) return setRight('lyrics');
    const line = e.target.closest('.lyr[data-t]');
    if (line && S.right === 'lyrics') {
      audio.currentTime = Number(line.dataset.t);
      if (audio.paused) togglePlay();
      lyr.userScroll = 0;
      return;
    }
    if (e.target.closest('[data-like]')) return toggleLike(t);
    if (e.target.closest('[data-radio]')) return openRadio(t);
    if (e.target.closest('[data-yt]')) return api.openExternal(`https://www.youtube.com/watch?v=${t.id}`);
    if (e.target.closest('[data-dlnow]')) return download([t]);
    const rm = e.target.closest('[data-rm]');
    if (rm) {
      const i = +rm.dataset.rm;
      S.queue.splice(i, 1);
      if (i <= S.qi + S.manual && S.manual > 0) S.manual--;
      renderRight();
      saveQueue();
      return;
    }
    const q = e.target.closest('[data-qi]');
    if (q && +q.dataset.qi !== S.qi) { S.qi = +q.dataset.qi; S.manual = 0; loadCurrent(); }
  };
  p.oncontextmenu = (e) => {
    const q = e.target.closest('[data-qi]');
    if (q) { e.preventDefault(); trackMenu(S.queue[+q.dataset.qi], e.clientX, e.clientY); }
  };
}

// ---------------------------------------------------------------- settings / accent
async function saveSettings(patch) {
  Object.assign(S.settings, patch);
  S.settings = await api.setSettings(patch);
}
function applyAppearance() {
  document.body.classList.toggle('lite', LITE());
  document.body.dataset.theme = LITE() ? 'dark' : S.settings.theme || 'dynamic';
  if (!DYNAMIC()) document.documentElement.style.removeProperty('--np-color');
}

function applyAccent() {
  const a = S.settings.accent || '#22d36b';
  document.documentElement.style.setProperty('--accent', a);
  document.documentElement.style.setProperty('--accent-hi', `color-mix(in srgb, ${a} 80%, white)`);
}

// ---------------------------------------------------------------- wiring
function wire() {
  $$('[data-icon]').forEach((e) => (e.innerHTML = icon(e.dataset.icon)));
  $('#homeBtn').onclick = () => go({ name: 'home' });
  $('#backBtn').onclick = back;
  $('#fwdBtn').onclick = fwd;
  $('#settingsBtn').onclick = () => go({ name: 'settings' });
  $('#newPlaylistBtn').onclick = () => newPlaylist();
  $('#libTitle').onclick = () => go({ name: 'list', id: 'liked' });
  $$('#libChips .chip').forEach((c) => (c.onclick = () => { S.libFilter = S.libFilter === c.dataset.filter ? null : c.dataset.filter; renderLib(); }));
  $('#playBtn').onclick = togglePlay;
  $('#nextBtn').onclick = () => next();
  $('#prevBtn').onclick = prev;
  $('#shuffleBtn').onclick = toggleShuffle;
  $('#repeatBtn').onclick = cycleRepeat;
  $('#queueBtn').onclick = () => setRight(S.right === 'queue' ? null : 'queue');
  $('#nowViewBtn').onclick = () => setRight(S.right === 'now' ? null : 'now');
  $('#lyricsBtn').onclick = () => setRight(S.right === 'lyrics' ? (mobile() ? 'now' : null) : 'lyrics');

  const q = $('#q');
  let qt;
  const doSearch = () => {
    const v = q.value.trim();
    $('#clearQ').classList.toggle('hidden', !q.value);
    if (R.cur.name === 'search') { if (R.cur.q !== v) go({ name: 'search', q: v }, { replace: true }); }
    else go({ name: 'search', q: v });
    q.focus();
  };
  q.addEventListener('input', () => { clearTimeout(qt); $('#clearQ').classList.toggle('hidden', !q.value); qt = setTimeout(doSearch, q.value.trim().length < 2 ? 1200 : 700); }); // wait for the user to pause typing
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { clearTimeout(qt); doSearch(); } if (e.key === 'Escape') q.blur(); });
  q.addEventListener('focus', () => { if (R.cur.name !== 'search' && !q.value) go({ name: 'search', q: '' }); });
  $('#clearQ').onclick = (e) => { e.preventDefault(); q.value = ''; doSearch(); };

  document.addEventListener('keydown', (e) => {
    const typing = e.target.matches('input, textarea, select');
    if (e.code === 'Space' && !typing) { e.preventDefault(); togglePlay(); }
    else if (e.ctrlKey && e.key === 'ArrowRight') next();
    else if (e.ctrlKey && e.key === 'ArrowLeft') prev();
    else if (e.ctrlKey && e.key === 'ArrowUp') { e.preventDefault(); setVolume(vol.value / 100 + 0.1); }
    else if (e.ctrlKey && e.key === 'ArrowDown') { e.preventDefault(); setVolume(vol.value / 100 - 0.1); }
    else if (e.ctrlKey && (e.key === 'l' || e.key === 'k')) { e.preventDefault(); q.focus(); q.select(); }
    else if (e.altKey && e.key === 'ArrowLeft') back();
    else if (e.altKey && e.key === 'ArrowRight') fwd();
  });
  let hoverTimer, hovered;
  document.addEventListener('mouseover', (e) => {
    const row = e.target.closest('.trow, .card, .q-item, .top-result');
    const id = row && (row.dataset.id || (row.dataset.qi && S.queue[+row.dataset.qi] && S.queue[+row.dataset.qi].id));
    if (!id || id === hovered) return;
    hovered = id;
    clearTimeout(hoverTimer);
    if (!LITE()) hoverTimer = setTimeout(() => api.warm(id), 250);
  });
  document.addEventListener('mouseup', (e) => { if (e.button === 3) back(); if (e.button === 4) fwd(); });

  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', togglePlay);
    ms.setActionHandler('pause', togglePlay);
    ms.setActionHandler('nexttrack', () => next());
    ms.setActionHandler('previoustrack', prev);
    ms.setActionHandler('seekto', (d) => { audio.currentTime = d.seekTime; });
  }

  let lastLibSig = '';
  api.on('lib:changed', (data) => {
    S.lib = data;
    S.liked = new Set(data.liked);
    if (viewSig(R.cur) !== R.cur.sig) renderSoon();
    else {
      updateHearts();
      $$('[data-dl]').forEach((e) => (e.innerHTML = dlIcon(e.dataset.dl)));
      const ls = libSig();
      if (ls !== lastLibSig) { lastLibSig = ls; renderLib(); }
    }
  });
  api.on('dl:progress', (p) => {
    if (p.state === 'none') delete S.dl[p.id]; else S.dl[p.id] = p;
    $$(`[data-dl="${p.id}"]`).forEach((e) => (e.innerHTML = dlIcon(p.id)));
    if (p.state === 'error') toast(`Download failed: ${(T(p.id) || {}).title || p.id}`);
  });
  api.on('status', (msg) => { $('#status').textContent = msg; });
  api.on('update', showUpdate);
  window.__naghamOpen = (q) => searchFor(q); // Android "share to Negaafy"
  window.addEventListener('online', () => setOnline(true));
  window.addEventListener('offline', () => setOnline(false));
  api.on('network', (n) => setOnline(!!(n && n.online)));
  // look the song up the moment a finger touches it, before the tap completes
  document.addEventListener('touchstart', (e) => {
    const row = e.target.closest('.trow, .card, .q-item, .top-result');
    const id = row && (row.dataset.id || (row.dataset.qi && S.queue[+row.dataset.qi] && S.queue[+row.dataset.qi].id));
    if (id && !LITE()) api.warm(id);
  }, { passive: true });
  // New images fade in once when they first arrive. An image already seen shows at
  // once whenever a page is rebuilt (fading those again made the screen flash).
  const seen = new Set();
  const shown = (e) => {
    if (e.target.tagName !== 'IMG') return;
    seen.add(e.target.src);
    e.target.classList.add('ok');
  };
  document.addEventListener('load', shown, true);
  document.addEventListener('error', shown, true);
  const markSeen = (img) => { if (seen.has(img.src) || (img.complete && img.naturalWidth)) img.classList.add('ok'); };
  new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.tagName === 'IMG') markSeen(n); else n.querySelectorAll('img').forEach(markSeen);
    }
  }).observe(document.body, { childList: true, subtree: true });
  $$('#tabbar [data-tab]').forEach((b) => (b.onclick = () => {
    const tab = b.dataset.tab;
    setRight(null);
    if (tab === 'search') { if (R.cur.name !== 'search') go({ name: 'search', q: '' }); $('#q').focus(); }
    else if (R.cur.name !== tab) go({ name: tab });
  }));
  window.addEventListener('resize', () => renderRight());
  // Android back button: close whatever is on top, then go back; false lets the OS handle it
  window.__naghamBack = () => {
    if (!menu.classList.contains('hidden')) { hideMenu(); return true; }
    if (!$('#modal').classList.contains('hidden')) { $('#modal').click(); return true; }
    if (S.right === 'lyrics' && mobile()) { setRight('now'); return true; }
    if (S.right) { setRight(null); return true; }
    if (R.stack.length) { back(); return true; }
    return false;
  };
}

function showUpdate(u) {
  const bar = $('#updateBar');
  if (!u || u.state === 'none' || u.state === 'error') { bar.classList.add('hidden'); return; }
  const label = {
    available: `Negaafy ${u.version} available`,
    downloading: `Downloading update${u.version ? ' ' + u.version : ''}… ${Math.round(u.pct || 0)}%`,
    ready: `Negaafy ${u.version} is ready to install`,
  }[u.state];
  const action = { available: 'Update', ready: 'Restart & update' }[u.state];
  bar.innerHTML = `<span>${icon('download', 's20')}</span><span class="u-text">${esc(label)}</span>${action ? `<button class="pill">${action}</button>` : ''}<button class="u-x" title="Later">${icon('close', 's16')}</button>`;
  bar.classList.remove('hidden');
  const btn = $('.pill', bar);
  if (btn) btn.onclick = () => { api.installUpdate(); if (u.state === 'available') showUpdate({ ...u, state: 'downloading', pct: 0 }); };
  $('.u-x', bar).onclick = () => bar.classList.add('hidden');
}

async function boot() {
  wire();
  const init = await api.init();
  S.port = init.port;
  S.settings = init.settings;
  S.lib = init.library;
  S.liked = new Set(init.library.liked);
  S.dl = init.downloads || {};
  S.hasDrive = init.hasDrive;
  S.platform = init.platform || 'desktop';
  document.body.classList.add('platform-' + S.platform);
  document.body.classList.toggle('offline', !S.online);
  if (mobile()) S.right = null;
  if (init.update) showUpdate(init.update);
  applyAccent();
  applyAppearance();
  setVolume(S.settings.volume ?? 0.8, false);
  const saved = store.get('queue', null);
  if (saved && saved.queue && saved.queue.length) {
    S.queue = saved.queue;
    S.qi = Math.min(saved.qi, saved.queue.length - 1);
    S.ctxKey = saved.ctxKey;
    S.resumeAt = saved.time || 0;
    renderNowPlaying();
    const d = current().duration;
    seek.value = d ? (S.resumeAt / d) * 1000 : 0;
    fill(seek);
    $('#tCur').textContent = fmt(S.resumeAt);
    $('#tDur').textContent = fmt(d);
  }
  syncControls();
  renderRight();
  go({ name: 'home' });
  if (init.open) searchFor(init.open);
  $$('img').forEach((i) => { if (i.complete) i.classList.add('ok'); });
  const splash = $('#splash');
  if (splash) {
    setTimeout(() => {
      splash.classList.add('out');
      setTimeout(() => splash.remove(), 450);
    }, Math.max(0, 500 - performance.now()));
  }
}

boot();
