package com.ayato.nagham;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.BeforeClass;
import org.junit.Test;

import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

/** Live checks against YouTube: run with ./gradlew testDebugUnitTest (needs internet). */
public class YouTubeTest {
    private static OkHttpClient http;
    private static YouTube yt;

    @BeforeClass
    public static void setUp() {
        http = new OkHttpClient.Builder().readTimeout(30, TimeUnit.SECONDS).build();
        yt = new YouTube(http);
    }

    @Test
    public void cleansTitles() {
        JSONObject t = YouTube.track("fGFB29lQ-Vs", "Amr Diab - Khalik Maaya (Official Video) | عمرو دياب", "Rotana", 233);
        assertEquals("Khalik Maaya", t.optString("title"));
        assertEquals("Amr Diab", t.optString("artist"));
    }

    @Test
    public void searchAndMix() throws Exception {
        long t0 = System.currentTimeMillis();
        JSONArray r = yt.search("عمرو دياب");
        System.out.println("search " + (System.currentTimeMillis() - t0) + " ms, " + r.length() + " results, first: " + r.getJSONObject(0));
        assertTrue(r.length() > 5);
        t0 = System.currentTimeMillis();
        JSONArray mix = yt.mix(r.getJSONObject(0).getString("id"));
        System.out.println("mix " + (System.currentTimeMillis() - t0) + " ms, " + mix.length() + " songs");
        assertTrue(mix.length() > 5);
    }

    @Test
    public void streamPlaysWithPlainRequest() throws Exception {
        for (String id : new String[] { "fGFB29lQ-Vs", "04qaw2nx5qY", "dQw4w9WgXcQ" }) {
            long t0 = System.currentTimeMillis();
            YouTube.Stream s = yt.stream(id, false);
            long lookup = System.currentTimeMillis() - t0;
            Request req = new Request.Builder().url(s.url).header("User-Agent", YouTube.UA).header("Range", "bytes=0-1048575").build();
            try (Response res = http.newCall(req).execute()) {
                int n = res.body().bytes().length;
                System.out.println(id + ": lookup " + lookup + " ms, " + s.mime + ", HTTP " + res.code() + ", " + n + " bytes, " + s.track.optString("title"));
                assertEquals(206, res.code());
                assertEquals(1048576, n);
            }
        }
    }

    @Test
    public void liteModeUsesSmallerAudio() throws Exception {
        YouTube.Stream best = yt.stream("fGFB29lQ-Vs", false), low = yt.stream("fGFB29lQ-Vs", true);
        long b = size(best.url), l = size(low.url);
        System.out.println("audio size: best " + b / 1024 + " KB, lite " + l / 1024 + " KB");
        assertTrue(l < b);
    }

    private long size(String url) throws Exception {
        Request req = new Request.Builder().url(url).header("User-Agent", YouTube.UA).header("Range", "bytes=0-0").build();
        try (Response res = http.newCall(req).execute()) {
            String cr = res.header("Content-Range");
            return Long.parseLong(cr.substring(cr.lastIndexOf('/') + 1));
        }
    }

    @Test
    public void findsSyncedLyrics() throws Exception {
        Lyrics ly = new Lyrics(http);
        JSONObject t = YouTube.track("fGFB29lQ-Vs", "Khalik Maaya", "Amr Diab", 233);
        JSONObject r = ly.find(t);
        System.out.println("lyrics: " + (r == null ? "none" : r.optString("synced").split("\n")[1]));
        assertTrue(r != null && !r.isNull("synced"));
        assertTrue(!Lyrics.goodSynced("[00:00.00]probe"));
    }

    @Test
    public void resolvesPlaylistLink() throws Exception {
        JSONObject p = yt.resolveUrl("https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI");
        System.out.println("playlist '" + p.optString("title") + "': " + p.getJSONArray("tracks").length() + " songs");
        assertTrue(p.getJSONArray("tracks").length() > 10);
    }
}
