// YouTube & YouTube Music API client for search, song radio, trending charts, and new releases.
// Uses YouTube Music (WEB_REMIX) primarily for pure music results with zero junk,
// falling back to standard YouTube Web API if needed.

const { toTrack, isSong } = require('./tracks');

const CLIENT_WEB = { clientName: 'WEB', clientVersion: '2.20250101.00.00', hl: 'en', gl: 'EG' };
const CLIENT_MUSIC = { clientName: 'WEB_REMIX', clientVersion: '1.20250101.01.00', hl: 'en', gl: 'EG' };

async function callWeb(endpoint, body) {
  const res = await fetch(`https://www.youtube.com/youtubei/v1/${endpoint}?prettyPrint=false`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-youtube-client-name': '1',
      'x-youtube-client-version': CLIENT_WEB.clientVersion,
    },
    body: JSON.stringify({ context: { client: CLIENT_WEB }, ...body }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`YouTube API HTTP ${res.status}`);
  return res.json();
}

async function callMusic(endpoint, body) {
  const res = await fetch(`https://music.youtube.com/youtubei/v1/${endpoint}?prettyPrint=false`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-youtube-client-name': '67',
      'x-youtube-client-version': CLIENT_MUSIC.clientVersion,
      'origin': 'https://music.youtube.com',
      'referer': 'https://music.youtube.com/',
    },
    body: JSON.stringify({ context: { client: CLIENT_MUSIC }, ...body }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`YouTube Music API HTTP ${res.status}`);
  return res.json();
}

function collect(node, key, out = []) {
  if (node && typeof node === 'object') {
    if (node[key]) out.push(node[key]);
    for (const v of Object.values(node)) collect(v, key, out);
  }
  return out;
}

const text = (t) => (t ? t.simpleText || (t.runs || []).map((r) => r.text).join('') : '');
const seconds = (s) => (s ? s.split(':').reduce((a, b) => a * 60 + Number(b), 0) : 0);

function parseMusicItem(it) {
  if (!it) return null;
  if (it.musicResponsiveListItemRenderer) it = it.musicResponsiveListItemRenderer;

  if (it.musicTwoRowItemRenderer) {
    const two = it.musicTwoRowItemRenderer;
    const title = text(two.title);
    const subtitle = text(two.subtitle);
    const videoId = two.navigationEndpoint?.watchEndpoint?.videoId
      || two.thumbnailOverlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId
      || JSON.stringify(two).match(/"videoId":"([a-zA-Z0-9_-]{11})"/)?.[1];
    if (!videoId) return null;
    const t = toTrack({
      id: videoId,
      title,
      channel: subtitle.split('•')[0].trim(),
      duration: 0,
      thumb: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    });
    return isSong(t) ? t : null;
  }

  const col0 = it.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
  const col1 = it.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
  const title = col0.map((r) => r.text).join('');

  let artist = '';
  let duration = 0;
  for (const r of col1) {
    const t = r.text.trim();
    if (t === '•' || t === 'Song' || t === 'Single' || t === 'Album' || t.includes('views') || t.includes('plays') || !t) continue;
    const m = t.match(/^(\d+):(\d+)$/);
    if (m) duration = parseInt(m[1]) * 60 + parseInt(m[2]);
    else if (!artist) artist = t;
  }

  const videoId = col0[0]?.navigationEndpoint?.watchEndpoint?.videoId
    || it.playlistItemData?.videoId
    || JSON.stringify(it).match(/"videoId":"([a-zA-Z0-9_-]{11})"/)?.[1];

  if (!videoId || !title) return null;
  const track = toTrack({
    id: videoId,
    title,
    channel: artist,
    duration,
    thumb: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  });
  return isSong(track) ? track : null;
}

function fromWebRenderer(v, channelKey) {
  return toTrack({ id: v.videoId, title: text(v.title), channel: text(v[channelKey]), duration: seconds(text(v.lengthText)) });
}

// ---------------------- Public APIs ----------------------

async function search(query) {
  // 1. YouTube Music, "Songs" filter: official audio only, so no live versions, covers
  //    or fan uploads, and song radio started from them stays on official songs too.
  //    Then YouTube Music unfiltered (finds remixes and uploads the filter leaves out).
  for (const params of ['EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D', undefined]) {
    try {
      const data = await callMusic('search', params ? { query, params } : { query });
      const tracks = collect(data, 'musicResponsiveListItemRenderer').map(parseMusicItem).filter(Boolean);
      if (tracks.length >= 3) return tracks;
    } catch {}
  }

  // 2. Fall back to YouTube search with strict anti-noise music filtering
  try {
    const data = await callWeb('search', { query, params: 'EgIQAQ%3D%3D' });
    const tracks = collect(data, 'videoRenderer').map((v) => fromWebRenderer(v, 'ownerText')).filter(isSong);
    if (tracks.length) return tracks;
  } catch {}

  throw new Error('No songs found');
}

// YouTube Music Mix: 50 pure music tracks seeded by a song
async function mix(id) {
  // 1. Try YouTube Music Radio first
  try {
    const data = await callMusic('next', { videoId: id, playlistId: 'RDAMVM' + id, isAudioOnly: true });
    const tracks = collect(data, 'playlistPanelVideoRenderer').map((v) => toTrack({
      id: v.videoId,
      title: text(v.title),
      channel: text(v.shortBylineText),
      duration: seconds(text(v.lengthText)),
    })).filter((t) => t && t.id !== id && isSong(t));
    if (tracks.length >= 5) return tracks;
  } catch {}

  // 2. Fallback to web mix
  const data = await callWeb('next', { videoId: id, playlistId: 'RD' + id });
  const tracks = collect(data, 'playlistPanelVideoRenderer').map((v) => fromWebRenderer(v, 'shortBylineText'))
    .filter((t) => t && t.id !== id && isSong(t));
  if (!tracks.length) throw new Error('No radio mix found');
  return tracks;
}

// Live Trending Music from YouTube Music Explore
async function trending() {
  try {
    const data = await callMusic('browse', { browseId: 'FEmusic_explore' });
    const carousels = collect(data, 'musicCarouselShelfRenderer');
    const trendCarousel = carousels.find((c) => {
      const h = text(c.header?.musicCarouselShelfBasicHeaderRenderer?.title).toLowerCase();
      return h.includes('trending') || h.includes('رائج') || h.includes('فيديوهات رائجة');
    });
    if (trendCarousel) {
      const tracks = (trendCarousel.contents || []).map(parseMusicItem).filter(Boolean);
      if (tracks.length) return tracks;
    }
  } catch {}

  // Fallback to top hits
  return search('Top Music Hits 2026');
}

// Live New Music Releases & Singles
async function newReleases() {
  try {
    const data = await callMusic('browse', { browseId: 'FEmusic_explore' });
    const carousels = collect(data, 'musicCarouselShelfRenderer');
    const newCarousel = carousels.find((c) => {
      const h = text(c.header?.musicCarouselShelfBasicHeaderRenderer?.title).toLowerCase();
      return h.includes('new') || h.includes('جديد') || h.includes('releases');
    });
    if (newCarousel) {
      const tracks = (newCarousel.contents || []).map(parseMusicItem).filter(Boolean);
      if (tracks.length) return tracks;
    }
  } catch {}

  // Fallback
  return search('New Arabic Songs 2026');
}

module.exports = { search, mix, trending, newReleases };
