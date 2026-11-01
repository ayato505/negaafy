package com.ayato.nagham;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Spotify-style recommendation algorithm for Negaafy on Android.
 * Analyzes user listening history and liked songs, groups top artists into Daily Mixes,
 * provides smart radio autoplay, and surfaces personalized taste profiles.
 */
public class RecommendationEngine {
    private final YouTube yt;
    private final Library lib;

    public RecommendationEngine(YouTube yt, Library lib) {
        this.yt = yt;
        this.lib = lib;
    }

    public JSONObject getTasteProfile() {
        JSONObject profile = new JSONObject();
        try {
            JSONObject data = lib.data();
            JSONObject tracks = data.optJSONObject("tracks");
            if (tracks == null) tracks = new JSONObject();
            JSONArray liked = data.optJSONArray("liked");
            if (liked == null) liked = new JSONArray();
            JSONArray history = data.optJSONArray("history");
            if (history == null) history = new JSONArray();

            Map<String, Integer> artistScores = new LinkedHashMap<>();
            Map<String, List<JSONObject>> artistTracks = new LinkedHashMap<>();
            List<JSONObject> favoriteTracks = new ArrayList<>();
            List<JSONObject> recentTracks = new ArrayList<>();

            for (int i = 0; i < liked.length(); i++) {
                String id = liked.optString(i);
                JSONObject t = tracks.optJSONObject(id);
                if (t == null) continue;
                if (favoriteTracks.size() < 30) favoriteTracks.add(t);
                String art = t.optString("artist", "Unknown").trim();
                if (art.isEmpty() || art.equalsIgnoreCase("Unknown") || art.equalsIgnoreCase("Unknown artist")) continue;
                artistScores.put(art, artistScores.getOrDefault(art, 0) + 5);
                artistTracks.computeIfAbsent(art, k -> new ArrayList<>()).add(t);
            }

            for (int i = 0; i < history.length(); i++) {
                String id = history.optString(i);
                JSONObject t = tracks.optJSONObject(id);
                if (t == null) continue;
                if (recentTracks.size() < 30) recentTracks.add(t);
                String art = t.optString("artist", "Unknown").trim();
                if (art.isEmpty() || art.equalsIgnoreCase("Unknown") || art.equalsIgnoreCase("Unknown artist")) continue;
                int recencyWeight = Math.max(1, 10 - (i / 5));
                artistScores.put(art, artistScores.getOrDefault(art, 0) + recencyWeight);
                List<JSONObject> list = artistTracks.computeIfAbsent(art, k -> new ArrayList<>());
                boolean exists = false;
                for (JSONObject x : list) {
                    if (id.equals(x.optString("id"))) { exists = true; break; }
                }
                if (!exists) list.add(t);
            }

            List<Map.Entry<String, Integer>> sorted = new ArrayList<>(artistScores.entrySet());
            sorted.sort((a, b) -> b.getValue().compareTo(a.getValue()));

            JSONArray topArtistsArr = new JSONArray();
            for (Map.Entry<String, Integer> entry : sorted) {
                JSONObject obj = new JSONObject();
                obj.put("artist", entry.getKey());
                obj.put("score", entry.getValue());
                JSONArray trackArr = new JSONArray();
                List<JSONObject> list = artistTracks.get(entry.getKey());
                if (list != null) for (JSONObject tr : list) trackArr.put(tr);
                obj.put("tracks", trackArr);
                topArtistsArr.put(obj);
            }

            profile.put("topArtists", topArtistsArr);
            profile.put("favoriteTracks", new JSONArray(favoriteTracks));
            profile.put("recentTracks", new JSONArray(recentTracks));
        } catch (Exception ignored) { }
        return profile;
    }

    public JSONArray getDailyMixes() {
        JSONArray mixes = new JSONArray();
        try {
            JSONObject profile = getTasteProfile();
            JSONArray artists = profile.optJSONArray("topArtists");
            if (artists == null || artists.length() == 0) return mixes;

            int chunkSize = 2;
            int total = Math.min(artists.length(), 6);
            for (int i = 0; i < total; i += chunkSize) {
                List<String> groupArtists = new ArrayList<>();
                JSONArray seedTracks = new JSONArray();

                for (int j = i; j < Math.min(i + chunkSize, total); j++) {
                    JSONObject a = artists.optJSONObject(j);
                    if (a != null) {
                        groupArtists.add(a.optString("artist"));
                        JSONArray trs = a.optJSONArray("tracks");
                        if (trs != null) {
                            for (int k = 0; k < trs.length() && seedTracks.length() < 4; k++) {
                                seedTracks.put(trs.optJSONObject(k));
                            }
                        }
                    }
                }

                if (seedTracks.length() == 0) continue;

                int mixNumber = (i / chunkSize) + 1;
                JSONObject mix = new JSONObject();
                mix.put("id", "mix_" + mixNumber);
                mix.put("title", "Daily Mix " + mixNumber);
                mix.put("subtitle", String.join(", ", groupArtists));
                mix.put("artists", new JSONArray(groupArtists));
                mix.put("seedTracks", seedTracks);
                mixes.put(mix);
            }
        } catch (Exception ignored) { }
        return mixes;
    }

    public JSONArray resolveDailyMix(String mixId) {
        JSONArray result = new JSONArray();
        try {
            JSONArray mixes = getDailyMixes();
            JSONObject chosen = null;
            for (int i = 0; i < mixes.length(); i++) {
                JSONObject m = mixes.optJSONObject(i);
                if (m != null && mixId.equals(m.optString("id"))) { chosen = m; break; }
            }
            if (chosen == null && mixes.length() > 0) chosen = mixes.optJSONObject(0);
            if (chosen == null) return result;

            JSONArray seeds = chosen.optJSONArray("seedTracks");
            if (seeds == null) return result;

            Set<String> seenIds = new HashSet<>();
            for (int i = 0; i < seeds.length(); i++) {
                JSONObject t = seeds.optJSONObject(i);
                if (t != null) {
                    seenIds.add(t.optString("id"));
                    result.put(t);
                }
            }

            for (int i = 0; i < Math.min(seeds.length(), 2); i++) {
                JSONObject s = seeds.optJSONObject(i);
                if (s == null) continue;
                String sid = s.optString("id");
                if (sid.isEmpty()) continue;
                try {
                    JSONArray radio = yt.mix(sid);
                    for (int j = 0; j < radio.length(); j++) {
                        JSONObject t = radio.optJSONObject(j);
                        if (t != null && !seenIds.contains(t.optString("id"))) {
                            seenIds.add(t.optString("id"));
                            result.put(t);
                        }
                        if (result.length() >= 30) break;
                    }
                } catch (Exception ignored) { }
                if (result.length() >= 30) break;
            }
        } catch (Exception ignored) { }
        return result;
    }

    public JSONArray getAutoplay(String lastTrackId) {
        JSONArray result = new JSONArray();
        try {
            JSONArray related = yt.mix(lastTrackId);
            JSONObject data = lib.data();
            JSONArray history = data != null ? data.optJSONArray("history") : null;
            Set<String> historyIds = new HashSet<>();
            if (history != null) {
                for (int i = 0; i < history.length(); i++) historyIds.add(history.optString(i));
            }
            JSONArray fresh = new JSONArray();
            for (int i = 0; i < related.length(); i++) {
                JSONObject t = related.optJSONObject(i);
                if (t != null && !historyIds.contains(t.optString("id"))) {
                    fresh.put(t);
                }
            }
            return fresh.length() > 0 ? fresh : related;
        } catch (Exception ignored) {
            return result;
        }
    }
}
