package com.ayato.nagham;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.schabi.newpipe.extractor.MediaFormat;
import org.schabi.newpipe.extractor.NewPipe;
import org.schabi.newpipe.extractor.ServiceList;
import org.schabi.newpipe.extractor.playlist.PlaylistInfo;
import org.schabi.newpipe.extractor.stream.AudioStream;
import org.schabi.newpipe.extractor.stream.DeliveryMethod;
import org.schabi.newpipe.extractor.stream.StreamInfo;
import org.schabi.newpipe.extractor.stream.StreamInfoItem;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/**
 * Search and song radio come straight from YouTube's web API (one fast request each),
 * the same way the desktop app does it. Audio links come from NewPipeExtractor.
 */
public class YouTube {
    public static final String UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0";
    private static final String CLIENT_VERSION = "2.20250101.00.00";
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    // Strip the usual YouTube noise from titles: "(Official Video)", "[Lyrics]", "| 4K" ...
    private static final Pattern NOISE = Pattern.compile(
            "\\s*[(\\[【]\\s*(official|lyrics?|lyric video|audio|video|music video|visuali[sz]er|hd|hq|4k|mv|clip|كليب|فيديو|اوديو|حصري|exclusive)[^)\\]】]*[)\\]】]",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern JUNK = Pattern.compile(
            "\\b(podcast|episode|interview|reaction|review|highlights?|match|gameplay|walkthrough|livestream|gaming|prank|vlog|challenge|trailer|teaser|tutorial|how\\s*to|10\\s*hours|1\\s*hour\\s*loop)\\b"
            + "|بودكاست|حلقة\\s*\\d*|لقاء\\s*مع|حوار\\s*مع|برنامج|ردة?\\s*فعل|مراجعة|تحليل|ملخص\\s*مباراة|أهداف|اهداف|بث\\s*مباشر|مقلب|مقالب|فلوج|تحدي|إعلان\\s*فيلم|اعلان\\s*فيلم|مسلسل|فيلم\\s*كامل|كامل\\s*مترجم|طريقة\\s*عمل|شرح\\s*برنامج|شرح\\s*طريقة|10\\s*ساعات|ساعة\\s*كاملة",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern DASH = Pattern.compile("^(.{1,60}?)\\s+[-–—]\\s+(.+)$");

    private final OkHttpClient http;

    public YouTube(OkHttpClient http) {
        this.http = http;
        NewPipe.init(new NewPipeDownloader(http));
    }

    // ------------------------------------------------------------ tracks

    public static JSONObject track(String id, String rawTitle, String channel, long duration) {
        String raw = rawTitle == null ? "" : rawTitle;
        String title = NOISE.matcher(raw).replaceAll("").replaceAll("\\s*\\|\\s*.*$", "").replaceAll("\\s{2,}", " ").trim();
        String artist = channel == null ? "" : channel.replaceAll("(?i)\\s*-\\s*Topic$", "").replaceAll("(?i)VEVO$", "").trim();
        Matcher m = DASH.matcher(title);
        if (m.matches()) { artist = m.group(1).trim(); title = m.group(2).trim(); }
        JSONObject t = new JSONObject();
        try {
            t.put("id", id);
            t.put("title", title.isEmpty() ? raw : title);
            t.put("artist", artist.isEmpty() ? "Unknown artist" : artist);
            t.put("duration", duration);
            t.put("thumb", "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg");
        } catch (JSONException ignored) { }
        return t;
    }

    private static boolean isSong(JSONObject t) {
        long d = t.optLong("duration");
        if (d > 0 && (d < 50 || d > 12 * 60)) return false;
        String text = t.optString("title", "") + " " + t.optString("artist", "");
        return !JUNK.matcher(text).find();
    }

    // ------------------------------------------------------------ web API

    private JSONObject call(String endpoint, JSONObject body) throws IOException, JSONException {
        JSONObject client = new JSONObject().put("clientName", "WEB").put("clientVersion", CLIENT_VERSION).put("hl", "en").put("gl", "EG");
        body.put("context", new JSONObject().put("client", client));
        Request req = new Request.Builder()
                .url("https://www.youtube.com/youtubei/v1/" + endpoint + "?prettyPrint=false")
                .header("User-Agent", UA)
                .header("X-YouTube-Client-Name", "1")
                .header("X-YouTube-Client-Version", CLIENT_VERSION)
                .post(RequestBody.create(body.toString(), JSON))
                .build();
        try (Response res = http.newCall(req).execute()) {
            if (!res.isSuccessful() || res.body() == null) throw new IOException("YouTube API HTTP " + res.code());
            return new JSONObject(res.body().string());
        }
    }

    private JSONObject callMusic(String endpoint, JSONObject body) throws IOException, JSONException {
        JSONObject client = new JSONObject()
                .put("clientName", "WEB_REMIX")
                .put("clientVersion", "1.20250101.01.00")
                .put("hl", "en")
                .put("gl", "EG");
        body.put("context", new JSONObject().put("client", client));
        Request req = new Request.Builder()
                .url("https://music.youtube.com/youtubei/v1/" + endpoint + "?prettyPrint=false")
                .header("User-Agent", UA)
                .header("X-YouTube-Client-Name", "67")
                .header("X-YouTube-Client-Version", "1.20250101.01.00")
                .header("Origin", "https://music.youtube.com")
                .header("Referer", "https://music.youtube.com/")
                .post(RequestBody.create(body.toString(), JSON))
                .build();
        try (Response res = http.newCall(req).execute()) {
            if (!res.isSuccessful() || res.body() == null) throw new IOException("YouTube Music API HTTP " + res.code());
            return new JSONObject(res.body().string());
        }
    }

    /** The response is a deep tree of "renderers"; collect every object stored under {@code key}. */
    private static void collect(Object node, String key, List<JSONObject> out) {
        if (node instanceof JSONObject) {
            JSONObject o = (JSONObject) node;
            JSONObject hit = o.optJSONObject(key);
            if (hit != null) out.add(hit);
            for (Iterator<String> it = o.keys(); it.hasNext(); ) collect(o.opt(it.next()), key, out);
        } else if (node instanceof JSONArray) {
            JSONArray a = (JSONArray) node;
            for (int i = 0; i < a.length(); i++) collect(a.opt(i), key, out);
        }
    }

    private static String text(JSONObject t) {
        if (t == null) return "";
        String s = t.optString("simpleText", null);
        if (s != null) return s;
        JSONArray runs = t.optJSONArray("runs");
        StringBuilder b = new StringBuilder();
        if (runs != null) for (int i = 0; i < runs.length(); i++) b.append(runs.optJSONObject(i).optString("text"));
        return b.toString();
    }

    private static long seconds(String s) {
        if (s == null || s.isEmpty()) return 0;
        long total = 0;
        for (String p : s.split(":")) {
            try { total = total * 60 + Long.parseLong(p.trim()); } catch (NumberFormatException e) { return 0; }
        }
        return total;
    }

    private static JSONObject fromRenderer(JSONObject v, String channelKey) {
        return track(v.optString("videoId"), text(v.optJSONObject("title")), text(v.optJSONObject(channelKey)),
                seconds(text(v.optJSONObject("lengthText"))));
    }

    private static JSONObject parseMusicItem(JSONObject it) {
        if (it == null) return null;
        JSONObject res = it.optJSONObject("musicResponsiveListItemRenderer");
        if (res != null) it = res;

        JSONObject two = it.optJSONObject("musicTwoRowItemRenderer");
        if (two != null) {
            String title = text(two.optJSONObject("title"));
            String subtitle = text(two.optJSONObject("subtitle"));
            String videoId = null;
            JSONObject nav = two.optJSONObject("navigationEndpoint");
            if (nav != null && nav.optJSONObject("watchEndpoint") != null) {
                videoId = nav.optJSONObject("watchEndpoint").optString("videoId");
            }
            if (videoId == null || videoId.isEmpty()) {
                Matcher m = Pattern.compile("\"videoId\":\"([a-zA-Z0-9_-]{11})\"").matcher(two.toString());
                if (m.find()) videoId = m.group(1);
            }
            if (videoId == null || videoId.length() != 11) return null;
            String channel = subtitle.split("•")[0].trim();
            JSONObject t = track(videoId, title, channel, 0);
            return isSong(t) ? t : null;
        }

        JSONArray cols = it.optJSONArray("flexColumns");
        if (cols == null || cols.length() == 0) return null;
        JSONObject col0 = cols.optJSONObject(0);
        JSONObject col1 = cols.length() > 1 ? cols.optJSONObject(1) : null;

        String title = "";
        String videoId = null;
        if (col0 != null) {
            JSONObject f0 = col0.optJSONObject("musicResponsiveListItemFlexColumnRenderer");
            if (f0 != null) {
                JSONObject txtObj = f0.optJSONObject("text");
                title = text(txtObj);
                JSONArray runs = txtObj != null ? txtObj.optJSONArray("runs") : null;
                if (runs != null && runs.length() > 0) {
                    JSONObject r0 = runs.optJSONObject(0);
                    JSONObject nav = r0 != null ? r0.optJSONObject("navigationEndpoint") : null;
                    if (nav != null && nav.optJSONObject("watchEndpoint") != null) {
                        videoId = nav.optJSONObject("watchEndpoint").optString("videoId");
                    }
                }
            }
        }
        if (videoId == null || videoId.isEmpty()) {
            JSONObject plData = it.optJSONObject("playlistItemData");
            if (plData != null) videoId = plData.optString("videoId");
        }
        if (videoId == null || videoId.isEmpty()) {
            Matcher m = Pattern.compile("\"videoId\":\"([a-zA-Z0-9_-]{11})\"").matcher(it.toString());
            if (m.find()) videoId = m.group(1);
        }
        if (videoId == null || videoId.length() != 11 || title.isEmpty()) return null;

        String artist = "";
        long duration = 0;
        if (col1 != null) {
            JSONObject f1 = col1.optJSONObject("musicResponsiveListItemFlexColumnRenderer");
            if (f1 != null) {
                JSONObject txtObj = f1.optJSONObject("text");
                JSONArray runs = txtObj != null ? txtObj.optJSONArray("runs") : null;
                if (runs != null) {
                    for (int i = 0; i < runs.length(); i++) {
                        String t = runs.optJSONObject(i).optString("text", "").trim();
                        if (t.equals("•") || t.equalsIgnoreCase("Song") || t.equalsIgnoreCase("Single") || t.equalsIgnoreCase("Album")
                                || t.contains("views") || t.contains("plays") || t.isEmpty()) continue;
                        if (t.matches("^\\d+:\\d+$")) duration = seconds(t);
                        else if (artist.isEmpty()) artist = t;
                    }
                }
            }
        }

        JSONObject t = track(videoId, title, artist, duration);
        return isSong(t) ? t : null;
    }

    public JSONArray search(String query) throws IOException, JSONException {
        // 1. Try pure YouTube Music search first (100% music, zero non-music noise)
        try {
            JSONObject data = callMusic("search", new JSONObject().put("query", query));
            List<JSONObject> items = new ArrayList<>();
            collect(data, "musicResponsiveListItemRenderer", items);
            JSONArray out = new JSONArray();
            for (JSONObject it : items) {
                JSONObject t = parseMusicItem(it);
                if (t != null) out.put(t);
            }
            if (out.length() >= 3) return out;
        } catch (Exception ignored) { }

        // 2. Fall back to YouTube search with strict anti-noise music filtering
        JSONObject data = call("search", new JSONObject().put("query", query).put("params", "EgIQAQ%3D%3D"));
        List<JSONObject> found = new ArrayList<>();
        collect(data, "videoRenderer", found);
        JSONArray out = new JSONArray();
        for (JSONObject v : found) {
            JSONObject t = fromRenderer(v, "ownerText");
            if (t.optString("id").length() == 11 && isSong(t)) out.put(t);
        }
        if (out.length() == 0) throw new IOException("no results");
        return out;
    }

    /** YouTube's "Mix" playlist seeded by a video: pure song radio. */
    public JSONArray mix(String id) throws IOException, JSONException {
        // 1. Try YouTube Music Radio first (pure music)
        try {
            JSONObject data = callMusic("next", new JSONObject().put("videoId", id).put("playlistId", "RDAMVM" + id).put("isAudioOnly", true));
            List<JSONObject> items = new ArrayList<>();
            collect(data, "playlistPanelVideoRenderer", items);
            JSONArray out = new JSONArray();
            for (JSONObject v : items) {
                JSONObject t = fromRenderer(v, "shortBylineText");
                String vid = t.optString("id");
                if (vid.length() == 11 && !vid.equals(id) && isSong(t)) out.put(t);
            }
            if (out.length() >= 5) return out;
        } catch (Exception ignored) { }

        // 2. Fall back to web mix
        JSONObject data = call("next", new JSONObject().put("videoId", id).put("playlistId", "RD" + id));
        List<JSONObject> found = new ArrayList<>();
        collect(data, "playlistPanelVideoRenderer", found);
        JSONArray out = new JSONArray();
        for (JSONObject v : found) {
            JSONObject t = fromRenderer(v, "shortBylineText");
            String vid = t.optString("id");
            if (vid.length() == 11 && !vid.equals(id) && isSong(t)) out.put(t);
        }
        if (out.length() == 0) throw new IOException("no mix");
        return out;
    }

    public JSONArray trending() {
        try {
            JSONObject data = callMusic("browse", new JSONObject().put("browseId", "FEmusic_explore"));
            List<JSONObject> carousels = new ArrayList<>();
            collect(data, "musicCarouselShelfRenderer", carousels);
            for (JSONObject c : carousels) {
                JSONObject header = c.optJSONObject("header");
                JSONObject basicHeader = header != null ? header.optJSONObject("musicCarouselShelfBasicHeaderRenderer") : null;
                String title = text(basicHeader != null ? basicHeader.optJSONObject("title") : null).toLowerCase();
                if (title.contains("trending") || title.contains("رائج") || title.contains("فيديوهات رائجة")) {
                    JSONArray contents = c.optJSONArray("contents");
                    if (contents != null) {
                        JSONArray out = new JSONArray();
                        for (int i = 0; i < contents.length(); i++) {
                            JSONObject t = parseMusicItem(contents.optJSONObject(i));
                            if (t != null) out.put(t);
                        }
                        if (out.length() > 0) return out;
                    }
                }
            }
        } catch (Exception ignored) { }
        try {
            return search("Top Music Hits 2026");
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    public JSONArray newReleases() {
        try {
            JSONObject data = callMusic("browse", new JSONObject().put("browseId", "FEmusic_explore"));
            List<JSONObject> carousels = new ArrayList<>();
            collect(data, "musicCarouselShelfRenderer", carousels);
            for (JSONObject c : carousels) {
                JSONObject header = c.optJSONObject("header");
                JSONObject basicHeader = header != null ? header.optJSONObject("musicCarouselShelfBasicHeaderRenderer") : null;
                String title = text(basicHeader != null ? basicHeader.optJSONObject("title") : null).toLowerCase();
                if (title.contains("new") || title.contains("جديد") || title.contains("releases")) {
                    JSONArray contents = c.optJSONArray("contents");
                    if (contents != null) {
                        JSONArray out = new JSONArray();
                        for (int i = 0; i < contents.length(); i++) {
                            JSONObject t = parseMusicItem(contents.optJSONObject(i));
                            if (t != null) out.put(t);
                        }
                        if (out.length() > 0) return out;
                    }
                }
            }
        } catch (Exception ignored) { }
        try {
            return search("New Arabic Songs 2026");
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    // ------------------------------------------------------------ NewPipe

    public static final class Stream {
        public final String url;
        public final String mime;
        public final long expires;
        public final JSONObject track;

        Stream(String url, String mime, long expires, JSONObject track) {
            this.url = url;
            this.mime = mime;
            this.expires = expires;
            this.track = track;
        }
    }

    /** lite: the smallest AAC stream (Lite mode saves data); otherwise the best one. */
    public Stream stream(String id, boolean lite) throws Exception {
        StreamInfo info = StreamInfo.getInfo(ServiceList.YouTube, "https://www.youtube.com/watch?v=" + id);
        AudioStream best = null;
        for (AudioStream s : info.getAudioStreams()) {
            if (!s.isUrl() || s.getDeliveryMethod() != DeliveryMethod.PROGRESSIVE_HTTP) continue;
            if (best == null || (lite ? scoreLow(s) > scoreLow(best) : score(s) > score(best))) best = s;
        }
        if (best == null) throw new IOException("no playable audio for " + id);
        String url = best.getContent();
        long expires = System.currentTimeMillis() + 3 * 3600_000L;
        Matcher m = Pattern.compile("[?&]expire=(\\d+)").matcher(url);
        if (m.find()) expires = Long.parseLong(m.group(1)) * 1000 - 5 * 60_000;
        MediaFormat f = best.getFormat();
        return new Stream(url, f == null ? "audio/mp4" : f.getMimeType(), expires,
                track(id, info.getName(), info.getUploaderName(), info.getDuration()));
    }

    private static int scoreLow(AudioStream s) {
        return (s.getFormat() == MediaFormat.M4A ? 1_000_000 : 0) - Math.max(0, s.getAverageBitrate());
    }

    // AAC (m4a) first: it plays and seeks well everywhere; then the highest bitrate
    private static int score(AudioStream s) {
        return (s.getFormat() == MediaFormat.M4A ? 1_000_000 : 0) + Math.max(0, s.getAverageBitrate());
    }

    /** Any YouTube link: one video or a whole playlist. */
    public JSONObject resolveUrl(String url) throws Exception {
        JSONObject out = new JSONObject();
        JSONArray tracks = new JSONArray();
        if (url.contains("list=") && !url.contains("list=RD")) {
            PlaylistInfo p = PlaylistInfo.getInfo(ServiceList.YouTube, url);
            for (StreamInfoItem it : p.getRelatedItems()) {
                String vid = ServiceList.YouTube.getStreamLHFactory().getId(it.getUrl());
                tracks.put(track(vid, it.getName(), it.getUploaderName(), it.getDuration()));
            }
            out.put("title", p.getName());
        } else {
            String vid = ServiceList.YouTube.getStreamLHFactory().getId(url);
            StreamInfo info = StreamInfo.getInfo(ServiceList.YouTube, "https://www.youtube.com/watch?v=" + vid);
            tracks.put(track(vid, info.getName(), info.getUploaderName(), info.getDuration()));
            out.put("title", info.getName());
        }
        out.put("tracks", tracks);
        return out;
    }
}
