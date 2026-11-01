package com.ayato.nagham;

import android.Manifest;
import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import com.google.common.util.concurrent.ListenableFuture;

/** One full-screen WebView running the same interface as the desktop app. */
public class MainActivity extends Activity {
    private static final String HOME = "https://appassets.androidplatform.net/assets/web/index.html";

    private WebView web;
    private Bridge bridge;
    private ListenableFuture<MediaController> controller;
    private ConnectivityManager net;
    private ConnectivityManager.NetworkCallback netWatch;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100); // the layout is designed for 100%; system font scaling broke it
        if (Build.VERSION.SDK_INT >= 23) s.setOffscreenPreRaster(true); // smoother first frames when the app comes back
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        // Serve the bundled UI from a secure origin so ES modules and localStorage work.
        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        web.setWebViewClient(new WebViewClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assets.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(@NonNull WebView view, @NonNull WebResourceRequest request) {
                startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl()));
                return true;
            }
        });
        // keep the UI (and the queue it manages) alive while the screen is off
        if (Build.VERSION.SDK_INT >= 26) web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);

        bridge = new Bridge(this, web);
        web.addJavascriptInterface(bridge, "NaghamNative");
        watchNetwork();
        web.loadUrl(HOME);

        SessionToken token = new SessionToken(this, new ComponentName(this, PlaybackService.class));
        controller = new MediaController.Builder(this, token).buildAsync();
        controller.addListener(() -> {
            try { bridge.attach(controller.get()); } catch (Exception ignored) { }
        }, ContextCompat.getMainExecutor(this));

        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 1);
        }
        handleShare(getIntent());
    }

    /** Tell the UI when the connection drops or comes back (drives navigator.onLine and the offline screen). */
    private void watchNetwork() {
        net = getSystemService(ConnectivityManager.class);
        web.setNetworkAvailable(isOnline());
        netWatch = new ConnectivityManager.NetworkCallback() {
            @Override public void onAvailable(Network n) { report(); }
            @Override public void onLost(Network n) { report(); }
            @Override public void onCapabilitiesChanged(Network n, NetworkCapabilities c) { report(); }
        };
        net.registerDefaultNetworkCallback(netWatch);
    }

    private boolean isOnline() {
        Network n = net.getActiveNetwork();
        NetworkCapabilities c = n == null ? null : net.getNetworkCapabilities(n);
        return c != null && c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private void report() {
        runOnUiThread(() -> {
            boolean on = isOnline();
            web.setNetworkAvailable(on);
            try { Bridge.emit("network", new org.json.JSONObject().put("online", on)); } catch (org.json.JSONException ignored) { }
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleShare(intent);
    }

    /** "Share → Negaafy" from the YouTube app opens that song or playlist. */
    private void handleShare(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null) return;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("https?://\\S+").matcher(text);
        bridge.open(m.find() ? m.group() : text.trim());
    }

    @Override
    protected void onResume() {
        super.onResume();
        NaghamApp.get().updater.checkQuietly();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript("window.__naghamBack ? window.__naghamBack() : false", (handled) -> {
            if (!"true".equals(handled)) moveTaskToBack(true);
        });
    }

    @Override
    protected void onDestroy() {
        if (netWatch != null) net.unregisterNetworkCallback(netWatch);
        bridge.detach();
        MediaController.releaseFuture(controller);
        web.destroy();
        super.onDestroy();
    }
}
