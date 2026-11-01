package com.ayato.nagham;

import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;

import androidx.annotation.NonNull;
import androidx.annotation.OptIn;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.ForwardingPlayer;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

import com.google.common.util.concurrent.ListenableFuture;
import com.google.common.util.concurrent.SettableFuture;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * Plays music in the background with the system media notification, lock screen and
 * headset controls. The queue lives in the UI, so next/previous are forwarded to it.
 */
@OptIn(markerClass = UnstableApi.class)
public class PlaybackService extends MediaSessionService {
    private MediaSession session;
    private ExoPlayer player;

    @Override
    public void onCreate() {
        super.onCreate();
        NaghamApp app = NaghamApp.get();
        // Buffer the whole song up front (like Spotify) so a weak connection can't cut it off.
        DefaultLoadControl load = new DefaultLoadControl.Builder()
                .setBufferDurationsMs(60_000, 20 * 60_000, 1_000, 2_000)
                .setPrioritizeTimeOverSizeThresholds(true)
                .build();
        player = new ExoPlayer.Builder(this)
                .setMediaSourceFactory(new DefaultMediaSourceFactory(new DefaultDataSource.Factory(this, app.cachedSource)))
                .setLoadControl(load)
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), true)
                .setHandleAudioBecomingNoisy(true)
                .setWakeMode(C.WAKE_MODE_NETWORK)
                .build();
        player.addListener(new Player.Listener() {
            @Override
            public void onPlayerError(@NonNull PlaybackException error) {
                MediaItem item = player.getCurrentMediaItem();
                if (item != null) app.forget(item.mediaId); // the next try looks the link up again
            }
        });

        Player forwarding = new ForwardingPlayer(player) {
            @NonNull
            @Override
            public Commands getAvailableCommands() {
                return super.getAvailableCommands().buildUpon()
                        .addAll(COMMAND_SEEK_TO_NEXT, COMMAND_SEEK_TO_PREVIOUS, COMMAND_SEEK_TO_NEXT_MEDIA_ITEM, COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
                        .build();
            }

            @Override
            public boolean isCommandAvailable(int command) {
                return getAvailableCommands().contains(command);
            }

            @Override public void seekToNext() { Bridge.media("nexttrack"); }
            @Override public void seekToNextMediaItem() { Bridge.media("nexttrack"); }
            @Override public void seekToPrevious() { Bridge.media("previoustrack"); }
            @Override public void seekToPreviousMediaItem() { Bridge.media("previoustrack"); }
        };

        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        session = new MediaSession.Builder(this, forwarding)
                .setSessionActivity(pi)
                .setCallback(new MediaSession.Callback() {
                    // The UI sends only the YouTube id; turn it into a playable file or link here.
                    @NonNull
                    @Override
                    public ListenableFuture<List<MediaItem>> onAddMediaItems(@NonNull MediaSession s, @NonNull MediaSession.ControllerInfo c,
                                                                            @NonNull List<MediaItem> items) {
                        SettableFuture<List<MediaItem>> result = SettableFuture.create();
                        app.io.execute(() -> {
                            try {
                                List<MediaItem> out = new ArrayList<>();
                                for (MediaItem it : items) {
                                    File local = app.lib.filePath(it.mediaId);
                                    Uri uri = local != null ? Uri.fromFile(local) : Uri.parse(app.stream(it.mediaId).url);
                                    out.add(it.buildUpon().setUri(uri).setCustomCacheKey(it.mediaId).build());
                                }
                                result.set(out);
                            } catch (Exception e) {
                                result.setException(e);
                            }
                        });
                        return result;
                    }
                })
                .build();
    }

    @Override
    public MediaSession onGetSession(@NonNull MediaSession.ControllerInfo controllerInfo) {
        return session;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // swiping the app away while paused stops everything; while playing, music keeps going
        if (!player.getPlayWhenReady() || player.getMediaItemCount() == 0) stopSelf();
    }

    @Override
    public void onDestroy() {
        session.release();
        player.release();
        super.onDestroy();
    }
}
