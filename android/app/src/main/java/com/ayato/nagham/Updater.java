package com.ayato.nagham;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

import okhttp3.Request;
import okhttp3.Response;

/**
 * Checks GitHub Releases of BuildConfig.UPDATE_REPO for a newer version and installs its APK.
 * Release tags look like "v1.2.0" and carry a "Negaafy-1.2.0.apk" asset.
 */
public class Updater {
    private final NaghamApp app;
    private JSONObject state;
    private String apkUrl;
    private String latest;
    private long lastCheck;

    Updater(NaghamApp app) { this.app = app; }

    public synchronized JSONObject state() { return state; }

    private void set(JSONObject s) {
        synchronized (this) { state = s; }
        Bridge.emit("update", s);
    }

    /** Version numbers compared part by part: 1.10.0 is newer than 1.9.3. */
    static int compare(String a, String b) {
        String[] x = a.replaceFirst("^v", "").split("[.-]"), y = b.replaceFirst("^v", "").split("[.-]");
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int p = i < x.length ? parse(x[i]) : 0, q = i < y.length ? parse(y[i]) : 0;
            if (p != q) return Integer.compare(p, q);
        }
        return 0;
    }

    private static int parse(String s) {
        try { return Integer.parseInt(s.replaceAll("\\D.*$", "")); } catch (NumberFormatException e) { return 0; }
    }

    /** Returns {version} when an update exists, null when up to date. */
    public JSONObject check() throws Exception {
        Request req = new Request.Builder()
                .url("https://api.github.com/repos/" + BuildConfig.UPDATE_REPO + "/releases/latest")
                .header("Accept", "application/vnd.github+json")
                .header("User-Agent", "Negaafy-Android/" + BuildConfig.VERSION_NAME)
                .build();
        try (Response res = app.http.newCall(req).execute()) {
            if (res.code() == 404) return null; // no releases yet
            if (!res.isSuccessful()) throw new Exception("GitHub HTTP " + res.code());
            JSONObject rel = new JSONObject(res.body().string());
            String version = rel.optString("tag_name").replaceFirst("^v", "");
            JSONArray assets = rel.optJSONArray("assets");
            String url = null;
            if (assets != null) for (int i = 0; i < assets.length(); i++) {
                JSONObject a = assets.getJSONObject(i);
                if (a.optString("name").toLowerCase(java.util.Locale.ROOT).endsWith(".apk")) url = a.optString("browser_download_url");
            }
            lastCheck = System.currentTimeMillis();
            if (url == null || compare(version, BuildConfig.VERSION_NAME) <= 0) return null;
            synchronized (this) { apkUrl = url; latest = version; }
            set(new JSONObject().put("state", "available").put("version", version).put("notes", rel.optString("body")));
            return new JSONObject().put("version", version);
        }
    }

    /** Quiet background check: at startup and then every few hours. */
    public void checkQuietly() {
        if (System.currentTimeMillis() - lastCheck < 3 * 3600_000L) return;
        app.io.execute(() -> { try { check(); } catch (Exception ignored) { } });
    }

    public void install() {
        final String url, version;
        synchronized (this) { url = apkUrl; version = latest; }
        if (url == null) return;
        if (Build.VERSION.SDK_INT >= 26 && !app.getPackageManager().canRequestPackageInstalls()) {
            // Android asks once: "allow Negaafy to install apps"
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + app.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            app.startActivity(i);
            try { set(new JSONObject().put("state", "available").put("version", version)); } catch (Exception ignored) { }
            return;
        }
        app.io.execute(() -> {
            try {
                File dir = new File(app.getExternalCacheDir() != null ? app.getExternalCacheDir() : app.getCacheDir(), "updates");
                dir.mkdirs();
                File apk = new File(dir, "Negaafy-" + version + ".apk");
                Request req = new Request.Builder().url(url).header("User-Agent", "Negaafy-Android").build();
                try (Response res = app.http.newCall(req).execute()) {
                    if (!res.isSuccessful()) throw new Exception("HTTP " + res.code());
                    long total = res.body().contentLength(), done = 0;
                    double last = -5;
                    try (InputStream in = res.body().byteStream(); FileOutputStream out = new FileOutputStream(apk)) {
                        byte[] buf = new byte[64 * 1024];
                        int n;
                        while ((n = in.read(buf)) > 0) {
                            out.write(buf, 0, n);
                            done += n;
                            double pct = total > 0 ? done * 100.0 / total : 0;
                            if (pct - last >= 3) { last = pct; set(new JSONObject().put("state", "downloading").put("version", version).put("pct", pct)); }
                        }
                    }
                }
                Uri uri = FileProvider.getUriForFile(app, app.getPackageName() + ".files", apk);
                Intent i = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                app.startActivity(i);
                set(new JSONObject().put("state", "none"));
            } catch (Exception e) {
                try { set(new JSONObject().put("state", "error").put("error", String.valueOf(e.getMessage()))); } catch (Exception ignored) { }
            }
        });
    }
}
