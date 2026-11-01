package com.ayato.nagham;

import android.app.Application;
import android.os.Environment;

import androidx.media3.database.StandaloneDatabaseProvider;
import androidx.media3.datasource.DataSpec;
import androidx.media3.datasource.cache.CacheDataSource;
import androidx.media3.datasource.cache.CacheWriter;
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor;
import androidx.media3.datasource.cache.SimpleCache;
import androidx.media3.datasource.okhttp.OkHttpDataSource;

import java.io.File;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;

/** Process-wide singletons: HTTP client, YouTube engine, library, audio cache, stream links. */
@androidx.annotation.OptIn(markerClass = androidx.media3.common.util.UnstableApi.class)
public class NaghamApp extends Application {
    private static NaghamApp instance;

    public OkHttpClient http;
    public YouTube yt;
    public Lyrics lyrics;
    public Library lib;
    public RecommendationEngine recommendations;
    public Downloads downloads;
    public Updater updater;
    public SimpleCache cache;
    public CacheDataSource.Factory cachedSource;
    public final ExecutorService io = Executors.newFixedThreadPool(6);
    private final ExecutorService prefetcher = Executors.newSingleThreadExecutor();
    private final Map<String, YouTube.Stream> streams = new ConcurrentHashMap<>();
    private final Map<String, CompletableFuture<YouTube.Stream>> lookups = new ConcurrentHashMap<>();
    private final Map<String, Boolean> prefetched = new ConcurrentHashMap<>();

    public static NaghamApp get() { return instance; }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        http = new OkHttpClient.Builder().connectTimeout(15, TimeUnit.SECONDS).readTimeout(30, TimeUnit.SECONDS).build();
        yt = new YouTube(http);
        lyrics = new Lyrics(http);
        File music = getExternalFilesDir(Environment.DIRECTORY_MUSIC);
        lib = new Library(getFilesDir(), new File(music != null ? music : getFilesDir(), "Songs"));
        recommendations = new RecommendationEngine(yt, lib);
        downloads = new Downloads(this);
        updater = new Updater(this);
        // whole songs are kept so replays start instantly and work offline
        cache = new SimpleCache(new File(getCacheDir(), "audio"), new LeastRecentlyUsedCacheEvictor(1024L * 1024 * 1024),
                new StandaloneDatabaseProvider(this));
        cachedSource = new CacheDataSource.Factory()
                .setCache(cache)
                .setUpstreamDataSourceFactory(new OkHttpDataSource.Factory(http).setUserAgent(YouTube.UA))
                .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR);
    }

    /** Audio link for a song, shared between playback, prefetch and "warm" lookups. */
    public YouTube.Stream stream(String id) throws Exception {
        YouTube.Stream s = streams.get(id);
        if (s != null && s.expires > System.currentTimeMillis()) return s;
        CompletableFuture<YouTube.Stream> mine = new CompletableFuture<>();
        CompletableFuture<YouTube.Stream> running = lookups.putIfAbsent(id, mine);
        if (running != null) {
            try { return running.get(40, TimeUnit.SECONDS); }
            catch (java.util.concurrent.ExecutionException e) { throw (Exception) e.getCause(); }
        }
        try {
            s = yt.stream(id, "lite".equals(lib.settings().optString("mode")));
            streams.put(id, s);
            mine.complete(s);
            return s;
        } catch (Exception e) {
            mine.completeExceptionally(e);
            throw e;
        } finally {
            lookups.remove(id);
        }
    }

    public void forget(String id) { streams.remove(id); prefetched.remove(id); }

    public void warm(String id) {
        if (lib.filePath(id) != null) return;
        io.execute(() -> { try { stream(id); } catch (Exception ignored) { } });
    }

    /** Download the next song into the cache in the background so it starts instantly. */
    public void prefetch(String id) {
        if (lib.filePath(id) != null || prefetched.putIfAbsent(id, true) != null) return;
        prefetcher.execute(() -> {
            try {
                YouTube.Stream s = stream(id);
                DataSpec spec = new DataSpec.Builder().setUri(s.url).setKey(id).build();
                new CacheWriter(cachedSource.createDataSource(), spec, null, null).cache();
            } catch (Exception e) {
                prefetched.remove(id);
            }
        });
    }
}
