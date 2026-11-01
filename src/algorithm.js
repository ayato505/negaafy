// Spotify-style recommendation algorithm for Negaafy.
// Analyzes user's listening history and liked songs, extracts top artists,
// and clusters them into personalized Daily Mixes, "Because you listened to...",
// and smart radio autoplay.

class RecommendationEngine {
  constructor(innertube, library) {
    this.innertube = innertube;
    this.library = library;
  }

  // Analyze listening history and liked songs to build a taste profile
  getTasteProfile() {
    const data = this.library.data || {};
    const tracks = data.tracks || {};
    const liked = (data.liked || []).map((id) => tracks[id]).filter(Boolean);
    const history = (data.history || []).map((id) => tracks[id]).filter(Boolean);

    // Calculate artist scores based on recency and frequency
    const artistScores = new Map();
    const artistTracks = new Map();

    // Liked songs have high baseline weight
    liked.forEach((t) => {
      const art = t.artist || 'Unknown';
      if (art === 'Unknown' || art === 'Unknown artist') return;
      artistScores.set(art, (artistScores.get(art) || 0) + 5);
      if (!artistTracks.has(art)) artistTracks.set(art, []);
      artistTracks.get(art).push(t);
    });

    // History has recency decay: recent songs get higher weight
    history.forEach((t, idx) => {
      const art = t.artist || 'Unknown';
      if (art === 'Unknown' || art === 'Unknown artist') return;
      // Index 0 is most recent
      const recencyWeight = Math.max(1, 10 - Math.floor(idx / 5));
      artistScores.set(art, (artistScores.get(art) || 0) + recencyWeight);
      if (!artistTracks.has(art)) artistTracks.set(art, []);
      if (!artistTracks.get(art).some((x) => x.id === t.id)) {
        artistTracks.get(art).push(t);
      }
    });

    const sortedArtists = [...artistScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([art]) => ({
        artist: art,
        score: artistScores.get(art),
        tracks: artistTracks.get(art) || [],
      }));

    return {
      topArtists: sortedArtists,
      favoriteTracks: liked.slice(0, 30),
      recentTracks: history.slice(0, 30),
    };
  }

  // Build Spotify-like "Daily Mix" playlists (Mix 1, Mix 2...)
  async getDailyMixes() {
    const profile = this.getTasteProfile();
    const artists = profile.topArtists;
    if (!artists.length) return [];

    // Group top artists into pairs/triplets for distinct mixes
    const mixes = [];
    const chunkSize = 2;

    for (let i = 0; i < Math.min(artists.length, 6); i += chunkSize) {
      const group = artists.slice(i, i + chunkSize);
      const groupArtists = group.map((g) => g.artist);
      const seedTracks = group.flatMap((g) => g.tracks).slice(0, 4);

      if (!seedTracks.length) continue;

      const mixNumber = Math.floor(i / chunkSize) + 1;
      const title = `Daily Mix ${mixNumber}`;
      const subtitle = groupArtists.join(', ');

      mixes.push({
        id: `mix_${mixNumber}`,
        title,
        subtitle,
        artists: groupArtists,
        seedTracks,
      });
    }

    return mixes;
  }

  // Generate songs for a Daily Mix on demand: blend user favorites + radio discoveries
  async resolveDailyMix(mixId) {
    const mixes = await this.getDailyMixes();
    const mix = mixes.find((m) => m.id === mixId) || mixes[0];
    if (!mix) return [];

    const tracks = [...mix.seedTracks];
    const seenIds = new Set(tracks.map((t) => t.id));

    // Fetch radio tracks for up to 2 seed tracks to expand the mix
    for (const seed of mix.seedTracks.slice(0, 2)) {
      try {
        const radio = await this.innertube.mix(seed.id);
        for (const t of radio) {
          if (!seenIds.has(t.id)) {
            seenIds.add(t.id);
            tracks.push(t);
          }
          if (tracks.length >= 30) break;
        }
      } catch {}
      if (tracks.length >= 30) break;
    }

    // Shuffle a bit so it's not strictly grouped by artist
    return tracks;
  }

  // Autoplay next track: when queue finishes, pick intelligent continuation
  async getAutoplay(lastTrackId) {
    try {
      const related = await this.innertube.mix(lastTrackId);
      const data = this.library.data || {};
      const historyIds = new Set(data.history || []);
      // Filter out songs already in recent history if possible
      const fresh = related.filter((t) => !historyIds.has(t.id));
      return fresh.length ? fresh : related;
    } catch {
      return [];
    }
  }
}

module.exports = { RecommendationEngine };
