package com.ayato.nagham;

import org.schabi.newpipe.extractor.downloader.Downloader;
import org.schabi.newpipe.extractor.downloader.Request;
import org.schabi.newpipe.extractor.downloader.Response;
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import okhttp3.OkHttpClient;
import okhttp3.RequestBody;

/** Lets NewPipeExtractor make its HTTP requests through the app's OkHttp client. */
public class NewPipeDownloader extends Downloader {
    private final OkHttpClient http;

    public NewPipeDownloader(OkHttpClient http) {
        this.http = http;
    }

    @Override
    public Response execute(Request request) throws IOException, ReCaptchaException {
        byte[] data = request.dataToSend();
        okhttp3.Request.Builder b = new okhttp3.Request.Builder()
                .url(request.url())
                .method(request.httpMethod(), data == null ? null : RequestBody.create(data))
                .header("User-Agent", YouTube.UA);
        for (Map.Entry<String, List<String>> h : request.headers().entrySet()) {
            b.removeHeader(h.getKey());
            for (String v : h.getValue()) b.addHeader(h.getKey(), v);
        }
        try (okhttp3.Response res = http.newCall(b.build()).execute()) {
            if (res.code() == 429) throw new ReCaptchaException("reCaptcha challenge requested", request.url());
            String body = res.body() == null ? null : res.body().string();
            return new Response(res.code(), res.message(), res.headers().toMultimap(), body, res.request().url().toString());
        }
    }
}
