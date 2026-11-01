package com.ayato.nagham;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Liked songs, playlists, history and downloads; the same JSON layout as the desktop app. */
public class Library {
    private static final Pattern AUDIO = Pattern.compile("\\[([\\w-]{11})\\]\\.(mp3|m4a|opus|webm|ogg|flac)$", Pattern.CASE_INSENSITIVE);

    public final File songsDir;
    private final File file;
    private final File settingsFile;
    private JSONObject data;
    private JSONObject settings;
    private Runnable onChange = () -> { };

    public Library(File dataDir, File songsDir) {
        this.songsDir = songsDir;
        songsDir.mkdirs();
        file = new File(dataDir, "nagham-library.json");
        settingsFile = new File(dataDir, "settings.json");
        data = read(file);
        settings = read(settingsFile);
        try {
            for (String k : new String[] { "liked", "playlists", "history" }) if (!data.has(k)) data.put(k, new JSONArray());
            if (!data.has("tracks")) data.put("tracks", new JSONObject());
            if (!settings.has("autoDownloadLiked")) settings.put("autoDownloadLiked", false);
            if (!settings.has("volume")) settings.put("volume", 1);
            if (!settings.has("format")) settings.put("format", "m4a");
        } catch (JSONException ignored) { }
        scan();
    }

    public void setOnChange(Runnable r) { onChange = r; }

    private static JSONObject read(File f) {
        try { return new JSONObject(new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8)); }
        catch (Exception e) { return new JSONObject(); }
    }

    private static void write(File f, JSONObject o) {
        File tmp = new File(f.getPath() + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(o.toString().getBytes(StandardCharsets.UTF_8));
            out.getFD().sync();
        } catch (Exception e) { return; }
        tmp.renameTo(f);
    }

    private void changed() {
        write(file, data);
        onChange.run();
    }

    public synchronized String json() { return data.toString(); }
    public synchronized JSONObject data() { return data; }
    public synchronized JSONObject settings() { return settings; }

    public synchronized JSONObject setSettings(JSONObject patch) throws JSONException {
        for (Iterator<String> it = patch.keys(); it.hasNext(); ) { String k = it.next(); settings.put(k, patch.get(k)); }
        write(settingsFile, settings);
        return settings;
    }

    private JSONObject tracks() { return data.optJSONObject("tracks"); }
    private JSONArray arr(String k) { return data.optJSONArray(k); }

    public synchronized JSONObject track(String id) { return tracks().optJSONObject(id); }

    public synchronized void scan() {
        Map<String, String> onDisk = new HashMap<>();
        File[] files = songsDir.listFiles();
        if (files != null) for (File f : files) {
            Matcher m = AUDIO.matcher(f.getName());
            if (m.find()) onDisk.put(m.group(1), f.getName());
        }
        try {
            for (Iterator<String> it = tracks().keys(); it.hasNext(); ) {
                JSONObject t = tracks().getJSONObject(it.next());
                if (t.has("file") && !onDisk.containsKey(t.optString("id"))) t.remove("file");
            }
            for (Map.Entry<String, String> e : onDisk.entrySet()) {
                JSONObject t = tracks().optJSONObject(e.getKey());
                if (t == null) {
                    t = YouTube.track(e.getKey(), e.getValue().replaceAll(AUDIO.pattern(), "").trim(), "Downloaded", 0);
                    t.put("addedAt", System.currentTimeMillis());
                    tracks().put(e.getKey(), t);
                }
                t.put("file", e.getValue());
            }
        } catch (JSONException ignored) { }
        changed();
    }

    public synchronized JSONObject upsert(JSONObject t) throws JSONException {
        String id = t.getString("id");
        JSONObject cur = tracks().optJSONObject(id);
        if (cur == null) { cur = new JSONObject(); cur.put("addedAt", System.currentTimeMillis()); }
        cur.put("id", id).put("title", t.optString("title")).put("artist", t.optString("artist")).put("thumb", t.optString("thumb"));
        long d = t.optLong("duration");
        cur.put("duration", d > 0 ? d : cur.optLong("duration"));
        tracks().put(id, cur);
        return cur;
    }

    private static JSONArray without(JSONArray a, String id) {
        JSONArray out = new JSONArray();
        for (int i = 0; i < a.length(); i++) if (!id.equals(a.optString(i))) out.put(a.opt(i));
        return out;
    }

    public synchronized void like(JSONObject t, boolean on) throws JSONException {
        upsert(t);
        JSONArray liked = without(arr("liked"), t.getString("id"));
        JSONArray next = new JSONArray();
        if (on) next.put(t.getString("id"));
        for (int i = 0; i < liked.length(); i++) next.put(liked.get(i));
        data.put("liked", next);
        changed();
    }

    public synchronized void history(JSONObject t) throws JSONException {
        upsert(t);
        JSONArray rest = without(arr("history"), t.getString("id"));
        JSONArray next = new JSONArray().put(t.getString("id"));
        for (int i = 0; i < rest.length() && next.length() < 100; i++) next.put(rest.get(i));
        data.put("history", next);
        changed();
    }

    private JSONObject playlist(String pid) {
        JSONArray pls = arr("playlists");
        for (int i = 0; i < pls.length(); i++) if (pid.equals(pls.optJSONObject(i).optString("id"))) return pls.optJSONObject(i);
        return null;
    }

    public synchronized JSONObject createPlaylist(String name, JSONArray tracks) throws JSONException {
        JSONArray ids = new JSONArray();
        for (int i = 0; i < tracks.length(); i++) { upsert(tracks.getJSONObject(i)); ids.put(tracks.getJSONObject(i).getString("id")); }
        JSONObject pl = new JSONObject().put("id", "pl" + Long.toString(System.currentTimeMillis(), 36)).put("name", name)
                .put("tracks", ids).put("createdAt", System.currentTimeMillis());
        JSONArray next = new JSONArray().put(pl);
        JSONArray pls = arr("playlists");
        for (int i = 0; i < pls.length(); i++) next.put(pls.get(i));
        data.put("playlists", next);
        changed();
        return pl;
    }

    public synchronized void renamePlaylist(String pid, String name) throws JSONException {
        JSONObject pl = playlist(pid);
        if (pl != null) { pl.put("name", name); changed(); }
    }

    public synchronized void deletePlaylist(String pid) throws JSONException {
        JSONArray pls = arr("playlists"), next = new JSONArray();
        for (int i = 0; i < pls.length(); i++) if (!pid.equals(pls.getJSONObject(i).optString("id"))) next.put(pls.get(i));
        data.put("playlists", next);
        changed();
    }

    public synchronized void addToPlaylist(String pid, JSONArray tracks) throws JSONException {
        JSONObject pl = playlist(pid);
        if (pl == null) return;
        JSONArray ids = pl.getJSONArray("tracks");
        for (int i = 0; i < tracks.length(); i++) {
            JSONObject t = tracks.getJSONObject(i);
            upsert(t);
            if (!without(ids, t.getString("id")).toString().equals(ids.toString())) continue; // already there
            ids.put(t.getString("id"));
        }
        changed();
    }

    public synchronized void removeFromPlaylist(String pid, String id) throws JSONException {
        JSONObject pl = playlist(pid);
        if (pl != null) { pl.put("tracks", without(pl.getJSONArray("tracks"), id)); changed(); }
    }

    public synchronized void setFile(String id, String name) throws JSONException {
        JSONObject t = track(id);
        if (t == null) return;
        if (name != null) t.put("file", name); else t.remove("file");
        changed();
    }

    public synchronized File filePath(String id) {
        JSONObject t = track(id);
        if (t == null || !t.has("file")) return null;
        File f = new File(songsDir, t.optString("file"));
        return f.exists() ? f : null;
    }

    public synchronized void deleteDownload(String id) throws JSONException {
        File f = filePath(id);
        if (f != null) f.delete();
        setFile(id, null);
    }
}
