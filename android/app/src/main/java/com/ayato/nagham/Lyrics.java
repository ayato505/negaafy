package com.ayato.nagham;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

/** Song lyrics from LRCLIB (free, no key, mostly time-synced). Same rules as src/lyrics.js. */
public class Lyrics {
    private static final String UA = "Negaafy/1.0 (https://github.com/ayato2x/negaafy)";
    private static final Pattern LINE = Pattern.compile("^\\[(\\d+):(\\d+(?:\\.\\d+)?)\\]\\s*(.*)$");

    private final OkHttpClient http;

    public Lyrics(OkHttpClient http) { this.http = http; }

    private Object get(String path, String... params) throws Exception {
        HttpUrl.Builder u = HttpUrl.get("https://lrclib.net/api/" + path).newBuilder();
        for (int i = 0; i + 1 < params.length; i += 2) if (params[i + 1] != null) u.addQueryParameter(params[i], params[i + 1]);
        try (Response res = http.newCall(new Request.Builder().url(u.build()).header("User-Agent", UA).build()).execute()) {
            if (res.code() == 404) return null;
            if (!res.isSuccessful()) throw new IOException("lyrics HTTP " + res.code());
            String body = res.body().string().trim();
            return body.startsWith("[") ? new JSONArray(body) : new JSONObject(body);
        }
    }

    // The database has junk entries ("[00:00.00]probe", every line at 0:00).
    static boolean goodSynced(String lrc) {
        if (lrc == null || lrc.isEmpty()) return false;
        int real = 0;
        Set<String> stamps = new HashSet<>();
        for (String l : lrc.split("\n")) {
            Matcher m = LINE.matcher(l);
            if (m.matches() && !m.group(3).trim().isEmpty()) { real++; stamps.add(m.group(1) + ":" + m.group(2)); }
        }
        return real >= 5 && stamps.size() >= 5;
    }

    static boolean goodPlain(String txt) {
        if (txt == null) return false;
        int n = 0;
        for (String l : txt.split("\n")) if (!l.trim().isEmpty()) n++;
        return n >= 4;
    }

    private static String str(JSONObject o, String k) { return o.isNull(k) ? null : o.optString(k, null); }

    private static JSONObject pick(JSONObject hit) throws Exception {
        if (hit == null) return null;
        String synced = str(hit, "syncedLyrics"), plain = str(hit, "plainLyrics");
        if (!goodSynced(synced)) synced = null;
        if (!goodPlain(plain)) plain = null;
        if (synced == null && plain == null) return null;
        return new JSONObject().put("synced", synced == null ? JSONObject.NULL : synced).put("plain", plain == null ? JSONObject.NULL : plain);
    }

    public JSONObject find(JSONObject t) throws Exception {
        String title = t.optString("title"), artist = t.optString("artist");
        long duration = t.optLong("duration");
        Object exact = null;
        try { exact = get("get", "track_name", title, "artist_name", artist, "duration", duration > 0 ? String.valueOf(duration) : null); }
        catch (Exception ignored) { }
        JSONObject hit = exact instanceof JSONObject ? pick((JSONObject) exact) : null;
        if (hit != null) return hit;
        // YouTube titles and channel names are noisy: search, preferring synced lyrics of the same length
        for (String q : new String[] { title + " " + artist, title }) {
            Object r = get("search", "q", q);
            if (!(r instanceof JSONArray)) continue;
            JSONArray list = (JSONArray) r;
            JSONObject plainHit = null;
            for (int i = 0; i < list.length(); i++) {
                JSONObject x = list.getJSONObject(i);
                long d = x.optLong("duration");
                boolean near = duration <= 0 || d <= 0 || Math.abs(d - duration) < 10;
                if (!near) continue;
                if (goodSynced(str(x, "syncedLyrics"))) return pick(x);
                if (plainHit == null && goodPlain(str(x, "plainLyrics"))) plainHit = x;
            }
            if (plainHit != null) return pick(plainHit);
        }
        return null;
    }
}
