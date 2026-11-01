// Turning YouTube video data into clean song entries.
// Strict anti-noise filter ensuring non-music content (podcasts, gaming, reviews, highlights) is rejected.

// Strip YouTube video clutter from titles
const NOISE = /\s*[([【]\s*(official|lyrics?|lyric video|audio|video|music video|visuali[sz]er|hd|hq|4k|mv|clip|كليب|فيديو كليب|فيديو|اوديو|أوديو|حصري|حصريا|حصرياً|exclusive|remastered|remaster)[^)\]】]*[)\]】]/gi;

// Keywords that indicate non-song content: podcasts, interviews, gaming, reviews, match highlights, tutorials, etc.
const JUNK = [
  /\bpodcast\b/i, /بودكاست/i, /\bepisode\b/i, /حلقة\s*\d*/i, /\binterview\b/i, /لقاء\s*مع/i, /حوار\s*مع/i, /برنامج/i,
  /\breaction\b/i, /ردة?\s*فعل/i, /\breview\b/i, /مراجعة/i, /تحليل/i,
  /\bhighlights?\b/i, /ملخص\s*مباراة/i, /أهداف/i, /اهداف/i, /\bmatch\b/i,
  /\bgameplay\b/i, /\bwalkthrough\b/i, /بث\s*مباشر/i, /\blivestream\b/i, /\bgaming\b/i,
  /\bprank\b/i, /مقلب/i, /مقالب/i, /\bvlog\b/i, /فلوج/i, /\bchallenge\b/i, /تحدي/i,
  /\btrailer\b/i, /\bteaser\b/i, /إعلان\s*فيلم/i, /اعلان\s*فيلم/i, /مسلسل/i, /فيلم\s*كامل/i, /كامل\s*مترجم/i,
  /\btutorial\b/i, /\bhow\s*to\b/i, /طريقة\s*عمل/i, /شرح\s*برنامج/i, /شرح\s*طريقة/i,
  /10\s*hours/i, /1\s*hour\s*loop/i, /10\s*ساعات/i, /ساعة\s*كاملة/i, /كوكتيل\s*ساعتين/i
];

function cleanTitle(raw, channel) {
  let title = (raw || '').replace(NOISE, '').replace(/\s*\|\s*.*$/, '').replace(/\s{2,}/g, ' ').trim();
  let artist = (channel || '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').replace(/Official\s*Channel$/i, '').trim();
  const dash = title.match(/^(.{1,60}?)\s+[-–—]\s+(.+)$/);
  if (dash) { artist = dash[1].trim(); title = dash[2].trim(); }
  return { title: title || raw, artist: artist || 'Unknown artist' };
}

function toTrack(e) {
  if (!e || !e.id || e.id.length !== 11) return null;
  const rawTitle = e.title || '';
  const channel = e.channel || e.uploader || e.artist || '';
  const { title, artist } = cleanTitle(rawTitle, channel);
  const duration = Math.round(e.duration || 0);

  const track = {
    id: e.id,
    title,
    artist,
    duration,
    thumb: e.thumb || `https://i.ytimg.com/vi/${e.id}/hqdefault.jpg`,
    rawTitle,
  };

  return track;
}

// Strict song-only validator: rejects any track containing non-music keywords or unnatural song duration
function isSong(t) {
  if (!t || !t.id) return false;
  // If duration is specified, songs are normally between 50s and 12 minutes
  if (t.duration && (t.duration < 50 || t.duration > 12 * 60)) return false;

  const textToCheck = `${t.title || ''} ${t.rawTitle || ''} ${t.artist || ''}`;
  for (const pat of JUNK) {
    if (pat.test(textToCheck)) return false;
  }
  return true;
}

module.exports = { cleanTitle, toTrack, isSong };
