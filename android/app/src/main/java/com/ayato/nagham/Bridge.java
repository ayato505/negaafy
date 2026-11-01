package com.ayato.nagham;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * window.NaghamNative: the Android side of window.api (see android/web/platform.js).
 * Calls are answered asynchronously through window.__nagham.done(); events go out
 * through window.__nagham.emit() and window.__nagham.audio().
 */
public class Bridge {
    private static volatile Bridge current;

    private final Activity activity;
    private final WebView web;
    private final NaghamApp app = NaghamApp.get();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final List<Runnable> waitingForPlayer = new ArrayList<>();
    private MediaController player;
    private String pendingOpen;

    /** A value that is already JSON text (passed through without quoting). */
    private static final class Raw {
        final String json;
        Raw(String json) { this.json = json; }
    }

    Bridge(Activity activity, WebView web) {
        this.activity = activity;
        this.web = web;
        current = this;
        app.lib.setOnChange(() -> emit("lib:changed", new Raw(app.lib.json())));
    }

    void detach() {
        if (current == this) current = null;
        if (player != null) player.removeListener(listener);
        main.removeCallbacks(ticker);
    }

    // ------------------------------------------------------------------ events out

    private void js(String code) {
        main.post(() -> web.evaluateJavascript(code, null));
    }

    private static String toJson(Object v) {
        if (v == null) return "null";
        if (v instanceof Raw) return ((Raw) v).json;
        if (v instanceof JSONObject || v instanceof JSONArray || v instanceof Number || v instanceof Boolean) return v.toString();
        return JSONObject.quote(String.valueOf(v));
    }

    static void emit(String channel, Object payload) {
        Bridge b = current;
        if (b != null) b.js("window.__nagham&&window.__nagham.emit(" + JSONObject.quote(channel) + "," + toJson(payload) + ")");
    }

    /** Media buttons from the notification, lock screen or headset. */
    static void media(String action) {
        Bridge b = current;
        if (b != null) b.js("window.__nagham&&window.__nagham.media(" + JSONObject.quote(action) + ")");
    }

    void open(String text) {
        if (text == null) return;
        pendingOpen = text;
        js("window.__naghamOpen&&window.__naghamOpen(" + JSONObject.quote(text) + ")");
    }

    // ------------------------------------------------------------------ calls in

    @JavascriptInterface
    public void call(String id, String method, String argsJson) {
        app.io.execute(() -> {
            String reply;
            try {
                reply = "true," + toJson(dispatch(method, new JSONArray(argsJson)));
            } catch (Throwable e) {
                reply = "false," + JSONObject.quote(e.getMessage() == null ? e.toString() : e.getMessage());
            }
            js("window.__nagham.done(" + JSONObject.quote(id) + "," + reply + ")");
        });
    }

    private Object dispatch(String m, JSONArray a) throws Exception {
        switch (m) {
            case "init": {
                String open = pendingOpen;
                pendingOpen = null;
                JSONObject upd = app.updater.state();
                return new Raw("{\"port\":0,\"platform\":\"android\",\"hasDrive\":false"
                        + ",\"settings\":" + app.lib.settings()
                        + ",\"library\":" + app.lib.json()
                        + ",\"downloads\":" + app.downloads.stateJson()
                        + ",\"update\":" + (upd == null ? "null" : upd)
                        + ",\"open\":" + (open == null ? "null" : JSONObject.quote(open)) + "}");
            }
            case "search": return app.yt.search(a.getString(0));
            case "related": return app.yt.mix(a.getString(0));
            case "lyrics": return app.lyrics.find(a.getJSONObject(0));
            case "resolveUrl": return app.yt.resolveUrl(a.getString(0));
            case "prefetch": app.prefetch(a.getString(0)); return null;
            case "warm": app.warm(a.getString(0)); return null;
            case "like": {
                JSONObject t = a.getJSONObject(0);
                boolean on = a.getBoolean(1);
                app.lib.like(t, on);
                if (on && app.lib.settings().optBoolean("autoDownloadLiked")) app.downloads.enqueue(t);
                return null;
            }
            case "history": app.lib.history(a.getJSONObject(0)); return null;
            case "createPlaylist": return app.lib.createPlaylist(a.getString(0), a.optJSONArray(1) == null ? new JSONArray() : a.getJSONArray(1));
            case "renamePlaylist": app.lib.renamePlaylist(a.getString(0), a.getString(1)); return null;
            case "deletePlaylist": app.lib.deletePlaylist(a.getString(0)); return null;
            case "addToPlaylist": app.lib.addToPlaylist(a.getString(0), a.getJSONArray(1)); return null;
            case "removeFromPlaylist": app.lib.removeFromPlaylist(a.getString(0), a.getString(1)); return null;
            case "download": {
                JSONArray list = a.getJSONArray(0);
                for (int i = 0; i < list.length(); i++) app.downloads.enqueue(list.getJSONObject(i));
                return null;
            }
            case "deleteDownload": app.lib.deleteDownload(a.getString(0)); return null;
            case "setSettings": return app.lib.setSettings(a.getJSONObject(0));
            case "pickFolder": return null;
            case "ytdlpVersion": return "NewPipe Extractor v0.26.5";
            case "engineInfo": return new JSONObject().put("version", "v0.26.5").put("fast", true);
            case "ytdlpUpdate": return "On Android the YouTube engine is updated together with the app.";
            case "openExternal": {
                String url = a.getString(0);
                if (url.startsWith("https://")) activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                return null;
            }
            case "openLibraryFolder":
                main.post(() -> Toast.makeText(activity, "Downloads are saved inside the app for offline listening", Toast.LENGTH_LONG).show());
                return null;
            case "rescan": app.lib.scan(); return null;
            case "appVersion": return BuildConfig.VERSION_NAME;
            case "checkUpdate": return app.updater.check();
            case "installUpdate": app.updater.install(); return null;
            case "trending": return app.yt.trending();
            case "newReleases": return app.yt.newReleases();
            case "dailyMixes": return app.recommendations.getDailyMixes();
            case "resolveDailyMix": return app.recommendations.resolveDailyMix(a.getString(0));
            case "tasteProfile": return app.recommendations.getTasteProfile();
            case "autoplay": return app.recommendations.getAutoplay(a.getString(0));
            default: throw new IllegalArgumentException("unknown call " + m);
        }
    }

    // ------------------------------------------------------------------ audio

    void attach(MediaController c) {
        player = c;
        player.addListener(listener);
        for (Runnable r : waitingForPlayer) r.run();
        waitingForPlayer.clear();
    }

    private void onPlayer(Runnable r) {
        main.post(() -> { if (player != null) r.run(); else waitingForPlayer.add(r); });
    }

    private void audio(String type, String msg) {
        if (player == null) return;
        try {
            JSONObject e = new JSONObject().put("type", type).put("t", player.getCurrentPosition() / 1000.0);
            long d = player.getDuration();
            if (d > 0) e.put("d", d / 1000.0);
            if (msg != null) e.put("msg", msg);
            web.evaluateJavascript("window.__nagham&&window.__nagham.audio(" + e + ")", null);
        } catch (Exception ignored) { }
    }

    private final Runnable ticker = new Runnable() {
        @Override
        public void run() {
            if (player != null && player.isPlaying()) {
                audio("timeupdate", null);
                main.postDelayed(this, 500);
            }
        }
    };

    private final Player.Listener listener = new Player.Listener() {
        @Override
        public void onPlaybackStateChanged(int state) {
            if (state == Player.STATE_BUFFERING && player.getPlayWhenReady()) audio("waiting", null);
            else if (state == Player.STATE_READY) {
                audio("loadedmetadata", null);
                audio("durationchange", null);
                audio("canplay", null);
                if (player.getPlayWhenReady()) audio("playing", null);
            } else if (state == Player.STATE_ENDED) audio("ended", null);
        }

        @Override
        public void onPlayWhenReadyChanged(boolean playWhenReady, int reason) {
            if (!playWhenReady) audio("pause", null);
            else if (player.getPlaybackState() == Player.STATE_READY) audio("playing", null);
            else if (player.getPlaybackState() == Player.STATE_BUFFERING) audio("waiting", null);
        }

        @Override
        public void onIsPlayingChanged(boolean isPlaying) {
            main.removeCallbacks(ticker);
            if (isPlaying) main.post(ticker);
        }

        @Override
        public void onPlayerError(@NonNull PlaybackException error) {
            audio("error", error.getMessage());
        }
    };

    @JavascriptInterface
    public void audioLoad(String id, String metaJson, boolean autoplay, long startMs) {
        onPlayer(() -> {
            MediaMetadata.Builder md = new MediaMetadata.Builder();
            try {
                JSONObject m = new JSONObject(metaJson);
                md.setTitle(m.optString("title")).setArtist(m.optString("artist")).setAlbumTitle("Negaafy");
                String art = m.optString("art");
                if (!art.isEmpty()) md.setArtworkUri(Uri.parse(art));
            } catch (Exception ignored) { }
            player.setMediaItem(new MediaItem.Builder().setMediaId(id).setMediaMetadata(md.build()).build(), Math.max(0, startMs));
            player.prepare();
            player.setPlayWhenReady(autoplay);
        });
    }

    @JavascriptInterface public void audioPlay() { onPlayer(() -> { if (player.getPlaybackState() == Player.STATE_ENDED) player.seekTo(0); player.play(); }); }
    @JavascriptInterface public void audioPause() { onPlayer(() -> player.pause()); }
    @JavascriptInterface public void audioSeek(long ms) { onPlayer(() -> player.seekTo(Math.max(0, ms))); }
    @JavascriptInterface public void audioVolume(float v) { onPlayer(() -> player.setVolume(Math.max(0f, Math.min(1f, v)))); }
    @JavascriptInterface public void audioStop() { onPlayer(() -> player.stop()); }
}
