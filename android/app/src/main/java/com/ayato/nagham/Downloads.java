package com.ayato.nagham;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.util.ArrayDeque;
import java.util.Deque;

import okhttp3.Request;
import okhttp3.Response;

/** Saves songs into the library folder, two at a time, reporting progress to the UI. */
public class Downloads {
    private static final long CHUNK = 4L * 1024 * 1024; // YouTube throttles very large single requests

    private final NaghamApp app;
    private final Deque<JSONObject> queue = new ArrayDeque<>();
    private final JSONObject state = new JSONObject();
    private int active = 0;

    Downloads(NaghamApp app) { this.app = app; }

    public synchronized String stateJson() { return state.toString(); }

    private synchronized void set(String id, String st, double pct, String error) {
        try {
            JSONObject s = new JSONObject().put("id", id).put("state", st).put("pct", pct);
            if (error != null) s.put("error", error);
            if ("none".equals(st)) state.remove(id); else state.put(id, s);
            Bridge.emit("dl:progress", s);
        } catch (JSONException ignored) { }
    }

    public synchronized void enqueue(JSONObject t) throws JSONException {
        String id = t.getString("id");
        JSONObject cur = state.optJSONObject(id);
        if (app.lib.filePath(id) != null || (cur != null && !"error".equals(cur.optString("state")))) return;
        app.lib.upsert(t);
        set(id, "queued", 0, null);
        queue.add(t);
        pump();
    }

    private synchronized void pump() {
        while (active < 2 && !queue.isEmpty()) {
            JSONObject t = queue.poll();
            active++;
            app.io.execute(() -> {
                try { run(t); }
                finally { synchronized (Downloads.this) { active--; } pump(); }
            });
        }
    }

    private void run(JSONObject t) {
        String id = t.optString("id");
        File part = null;
        try {
            set(id, "downloading", 0, null);
            YouTube.Stream s = app.stream(id);
            String ext = s.mime.contains("webm") ? "webm" : "m4a";
            String safe = t.optString("title", id).replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", " ").replaceAll("\\s+", " ").trim();
            if (safe.length() > 70) safe = safe.substring(0, 70).trim();
            String name = safe + " [" + id + "]." + ext;
            part = new File(app.lib.songsDir, name + ".part");
            long size = -1, done = 0;
            double last = 0;
            try (RandomAccessFile out = new RandomAccessFile(part, "rw")) {
                out.setLength(0);
                while (size < 0 || done < size) {
                    long end = size < 0 ? CHUNK - 1 : Math.min(size - 1, done + CHUNK - 1);
                    Request req = new Request.Builder().url(s.url).header("User-Agent", YouTube.UA).header("Range", "bytes=" + done + "-" + end).build();
                    try (Response res = app.http.newCall(req).execute()) {
                        if (res.code() != 206 && res.code() != 200) throw new Exception("HTTP " + res.code());
                        if (size < 0) {
                            String cr = res.header("Content-Range");
                            size = cr != null ? Long.parseLong(cr.substring(cr.lastIndexOf('/') + 1)) : res.body().contentLength();
                        }
                        try (InputStream in = res.body().byteStream()) {
                            byte[] buf = new byte[64 * 1024];
                            int n;
                            while ((n = in.read(buf)) > 0) {
                                out.write(buf, 0, n);
                                done += n;
                                double pct = Math.min(99, done * 100.0 / size);
                                if (pct - last >= 2) { last = pct; set(id, "downloading", pct, null); }
                            }
                        }
                    }
                }
            }
            File dest = new File(app.lib.songsDir, name);
            if (!part.renameTo(dest)) throw new Exception("could not save file");
            app.lib.setFile(id, name);
            set(id, "none", 0, null);
        } catch (Exception e) {
            if (part != null) part.delete();
            app.forget(id);
            set(id, "error", 0, String.valueOf(e.getMessage()));
        }
    }
}
