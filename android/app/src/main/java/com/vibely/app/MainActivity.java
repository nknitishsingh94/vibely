package com.vibely.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.database.ContentObserver;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.net.http.SslError;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.content.Context;
import android.content.SharedPreferences;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.BridgeWebViewClient;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    public static volatile boolean isAppInForeground = false;
    private static volatile MainActivity instance;
    public static volatile String lastPendingCallJson = null;

    private ContentObserver screenshotObserver;
    private String lastCapturedScreenshotPath = "";
    private long lastCapturedScreenshotTime = 0;

    public static MainActivity getInstance() {
        return instance;
    }

    public void notifyIncomingCall(String callJson) {
        lastPendingCallJson = callJson;
        runOnUiThread(() -> {
            try {
                Bridge b = getBridge();
                if (b != null && b.getWebView() != null) {
                    b.getWebView().evaluateJavascript(
                        "if (window.onVibelyNativeIncomingCall) { window.onVibelyNativeIncomingCall(" + callJson + "); } else { window.dispatchEvent(new CustomEvent('vibely_native_incoming_call', { detail: " + callJson + " })); }",
                        null
                    );
                }
            } catch (Throwable ignored) {}
        });
    }

    public void notifyCallCancelled(String callJson) {
        lastPendingCallJson = null;
        runOnUiThread(() -> {
            try {
                Bridge b = getBridge();
                if (b != null && b.getWebView() != null) {
                    b.getWebView().evaluateJavascript(
                        "if (window.onVibelyNativeCallCancelled) { window.onVibelyNativeCallCancelled(" + callJson + "); } else { window.dispatchEvent(new CustomEvent('vibely_native_call_cancelled', { detail: " + callJson + " })); }",
                        null
                    );
                }
            } catch (Throwable ignored) {}
        });
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        instance = this;
        isAppInForeground = true;

        // Auto-start Vibely background service if user was previously logged in
        try {
            SharedPreferences prefs = getSharedPreferences("vibely_prefs", Context.MODE_PRIVATE);
            String savedUserId = prefs.getString("user_id", null);
            if (savedUserId != null && !savedUserId.trim().isEmpty()) {
                VibelyBackgroundService.startService(this, savedUserId);
            }
        } catch (Throwable ignored) {
        }

        // 1. Request runtime notification, camera, microphone & media storage permissions
        try {
            List<String> neededPermissions = new ArrayList<>();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    neededPermissions.add(Manifest.permission.POST_NOTIFICATIONS);
                }
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED) {
                    neededPermissions.add(Manifest.permission.READ_MEDIA_IMAGES);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                    neededPermissions.add(Manifest.permission.READ_EXTERNAL_STORAGE);
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    neededPermissions.add(Manifest.permission.RECORD_AUDIO);
                }
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                    neededPermissions.add(Manifest.permission.CAMERA);
                }
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.MODIFY_AUDIO_SETTINGS) != PackageManager.PERMISSION_GRANTED) {
                    neededPermissions.add(Manifest.permission.MODIFY_AUDIO_SETTINGS);
                }
            }

            if (!neededPermissions.isEmpty()) {
                ActivityCompat.requestPermissions(
                        this,
                        neededPermissions.toArray(new String[0]),
                        101
                );
            }
        } catch (Throwable ignored) {
        }

        // 2. Android 14+ (API 34+) Native Official ScreenCaptureCallback via isolated helper class
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            try {
                Api34Helper.registerScreenCapture(this);
            } catch (Throwable ignored) {
            }
        }

        // 3. Fallback ContentObserver for Android 10-13 (Detects screenshot saved to storage)
        try {
            registerScreenshotObserver();
        } catch (Throwable ignored) {
        }

        // 4. Configure WebView settings and resilient network/SSL error handling
        try {
            Bridge b = getBridge();
            if (b != null) {
                WebView webView = b.getWebView();
                if (webView != null) {
                    WebSettings settings = webView.getSettings();
                    settings.setDomStorageEnabled(true);
                    settings.setDatabaseEnabled(true);
                    settings.setAllowFileAccess(true);
                    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
                    settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                    settings.setMediaPlaybackRequiresUserGesture(false);

                    // Ensure cookies are enabled and persisted for Supabase Auth and Next.js
                    android.webkit.CookieManager cookieManager = android.webkit.CookieManager.getInstance();
                    cookieManager.setAcceptCookie(true);
                    cookieManager.setAcceptThirdPartyCookies(webView, true);

                    // Clean UserAgent: Strip 'Version/X.X' and '; wv' so Google/SSO treat WebView as Chrome Mobile
                    String originalUa = settings.getUserAgentString();
                    if (originalUa != null) {
                        String cleanedUa = originalUa
                                .replaceAll(";\\s*wv", "")
                                .replaceAll("Version/\\d+\\.\\d+\\s*", "");
                        if (!cleanedUa.contains("VibelyApp")) {
                            cleanedUa = cleanedUa + " VibelyApp/1.0";
                        }
                        settings.setUserAgentString(cleanedUa);
                    }

                    // Register Native Bridge for JavaScript communication
                    webView.addJavascriptInterface(new VibelyNativeBridge(this), "VibelyNative");

                    // Crucial: Automatically grant WebRTC Audio & Video permissions to WebView
                    webView.setWebChromeClient(new BridgeWebChromeClient(b) {
                        @Override
                        public void onPermissionRequest(final PermissionRequest request) {
                            runOnUiThread(() -> {
                                try {
                                    if (request != null) {
                                        request.grant(request.getResources());
                                    }
                                } catch (Throwable t) {
                                    try {
                                        super.onPermissionRequest(request);
                                    } catch (Throwable ignored) {}
                                }
                            });
                        }
                    });
                }

                b.setWebViewClient(new BridgeWebViewClient(b) {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        super.onPageFinished(view, url);
                        try {
                            android.webkit.CookieManager.getInstance().flush();
                        } catch (Throwable ignored) {
                        }
                    }

                    @Override
                    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                        if (request != null && request.getUrl() != null) {
                            String url = request.getUrl().toString();
                            // Keep all Vibely pages, localhost, and Google/Supabase Auth inside the in-app WebView
                            if (url.contains("vibely-sigma-roan.vercel.app") || url.startsWith("/") || url.contains("localhost")) {
                                return false;
                            }
                            if (url.contains("accounts.google.com") || url.contains("supabase.co/auth")) {
                                return false;
                            }
                        }
                        return super.shouldOverrideUrlLoading(view, request);
                    }

                    @Override
                    public boolean shouldOverrideUrlLoading(WebView view, String url) {
                        if (url != null) {
                            if (url.contains("vibely-sigma-roan.vercel.app") || url.startsWith("/") || url.contains("localhost")) {
                                return false;
                            }
                            if (url.contains("accounts.google.com") || url.contains("supabase.co/auth")) {
                                return false;
                            }
                        }
                        return super.shouldOverrideUrlLoading(view, url);
                    }

                    @Override
                    public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                        // Allow secure connection even if intermediate certificate or system clock drift occurs
                        if (handler != null) {
                            handler.proceed();
                        }
                    }

                    @Override
                    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                        super.onReceivedError(view, request, error);
                        if (request != null && request.isForMainFrame()) {
                            String urlStr = request.getUrl() != null ? request.getUrl().toString() : "";
                            if (urlStr.contains("localhost")) {
                                if (view != null) {
                                    view.loadUrl("https://vibely-sigma-roan.vercel.app/chat");
                                }
                                return;
                            }
                            // Retry loading if connection momentarily dropped
                            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                                if (view != null) {
                                    view.reload();
                                }
                            }, 3500);
                        }
                    }

                    @Override
                    public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                        super.onReceivedError(view, errorCode, description, failingUrl);
                        if (failingUrl != null && failingUrl.contains("localhost")) {
                            if (view != null) {
                                view.loadUrl("https://vibely-sigma-roan.vercel.app/chat");
                            }
                            return;
                        }
                        new Handler(Looper.getMainLooper()).postDelayed(() -> {
                            if (view != null) {
                                view.reload();
                            }
                        }, 3500);
                    }
                });

                // Check if launched via Deep Link intent
                handleIncomingIntent(getIntent());

                // Immediately load live Vibely chat so the app directly opens the app/login and NEVER stays on localhost or marketing page
                if (webView != null) {
                    String current = webView.getUrl();
                    if (current == null || current.contains("localhost")) {
                        webView.loadUrl("https://vibely-sigma-roan.vercel.app/chat");
                    }
                }
            }
        } catch (Throwable ignored) {
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        isAppInForeground = true;
        // Stop background ringtone and cancel notification if user opened the app
        try {
            VibelyBackgroundService service = VibelyBackgroundService.getInstance();
            if (service != null) {
                service.stopRinging();
            }
            android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(VibelyBackgroundService.NOTIFICATION_CALL_ID);
            }
        } catch (Throwable ignored) {}
        handleIncomingIntent(getIntent());
    }

    @Override
    public void onPause() {
        super.onPause();
        isAppInForeground = false;
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    private void handleIncomingIntent(android.content.Intent intent) {
        if (intent == null) return;
        try {
            Bridge b = getBridge();
            if (b == null || b.getWebView() == null) return;

            // 0. Native incoming call payload from notification action
            if (intent.hasExtra("callData")) {
                String callData = intent.getStringExtra("callData");
                if (callData != null && !callData.trim().isEmpty()) {
                    notifyIncomingCall(callData);
                }
            }

            // 1. Direct targetUrl extra (from notification click)
            if (intent.hasExtra("targetUrl")) {
                String targetUrl = intent.getStringExtra("targetUrl");
                if (targetUrl != null && !targetUrl.isEmpty()) {
                    b.getWebView().loadUrl(targetUrl);
                    return;
                }
            }

            // 2. Deep Link data intent
            if (intent.getData() != null) {
                android.net.Uri data = intent.getData();
                String scheme = data.getScheme();
                String host = data.getHost();
                if ("vibely".equals(scheme) || "com.vibely.app".equals(scheme)) {
                    String path = data.getPath() != null ? data.getPath() : "";
                    String query = data.getQuery() != null ? "?" + data.getQuery() : "";
                    String fragment = data.getFragment() != null ? "#" + data.getFragment() : "";
                    String target = "https://vibely-sigma-roan.vercel.app" + path + query + fragment;
                    b.getWebView().loadUrl(target);
                } else if ("vibely-sigma-roan.vercel.app".equals(host)) {
                    b.getWebView().loadUrl(data.toString());
                }
            }
        } catch (Throwable ignored) {
        }
    }

    @androidx.annotation.RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
    private static class Api34Helper {
        static void registerScreenCapture(MainActivity activity) {
            try {
                activity.registerScreenCaptureCallback(
                    activity.getMainExecutor(),
                    new ScreenCaptureCallback() {
                        @Override
                        public void onScreenCaptured() {
                            activity.notifyScreenshotDetected();
                        }
                    }
                );
            } catch (Throwable ignored) {
            }
        }
    }

    private void registerScreenshotObserver() {
        try {
            Handler handler = new Handler(Looper.getMainLooper());
            screenshotObserver = new ContentObserver(handler) {
                @Override
                public void onChange(boolean selfChange, Uri uri) {
                    super.onChange(selfChange, uri);
                    if (uri == null) return;
                    checkScreenshotFromUri(uri);
                }
            };

            getContentResolver().registerContentObserver(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                    true,
                    screenshotObserver
            );
        } catch (Exception ignored) {
            // Observer registration fail-safe
        }
    }

    private void checkScreenshotFromUri(Uri uri) {
        try {
            String[] projection = new String[]{
                    MediaStore.Images.Media._ID,
                    MediaStore.Images.Media.DISPLAY_NAME,
                    MediaStore.Images.Media.DATE_ADDED,
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? MediaStore.Images.Media.RELATIVE_PATH : MediaStore.Images.Media.DATA
            };
            String sortOrder = MediaStore.Images.Media.DATE_ADDED + " DESC";
            try (Cursor cursor = getContentResolver().query(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                    projection,
                    null,
                    null,
                    sortOrder
            )) {
                if (cursor != null && cursor.moveToFirst()) {
                    long now = System.currentTimeMillis();
                    int dateAddedIdx = cursor.getColumnIndex(MediaStore.Images.Media.DATE_ADDED);
                    long dateAddedSec = dateAddedIdx != -1 ? cursor.getLong(dateAddedIdx) : 0;
                    long dateAddedMs = dateAddedSec * 1000L;

                    // Must be captured recently (within last 15 seconds)
                    if (Math.abs(now - dateAddedMs) > 15000 && dateAddedMs > 0) {
                        return;
                    }

                    int nameIdx = cursor.getColumnIndex(MediaStore.Images.Media.DISPLAY_NAME);
                    String name = nameIdx != -1 ? cursor.getString(nameIdx) : "";

                    String path = "";
                    try {
                        int pathIdx = cursor.getColumnIndex(Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? MediaStore.Images.Media.RELATIVE_PATH : MediaStore.Images.Media.DATA);
                        if (pathIdx != -1) {
                            path = cursor.getString(pathIdx);
                        }
                    } catch (Exception ignored) {}

                    String checkStr = ((name != null ? name : "") + " " + (path != null ? path : "")).toLowerCase();
                    boolean isScreenshot = checkStr.contains("screenshot") ||
                                           checkStr.contains("screen_shot") ||
                                           checkStr.contains("screencap") ||
                                           checkStr.contains("screen-shot") ||
                                           checkStr.contains("capture");

                    if (isScreenshot && !checkStr.equals(lastCapturedScreenshotPath) && (now - lastCapturedScreenshotTime > 2500)) {
                        lastCapturedScreenshotPath = checkStr;
                        lastCapturedScreenshotTime = now;
                        notifyScreenshotDetected();
                    }
                }
            }
        } catch (Exception ignored) {
        }
    }

    private void notifyScreenshotDetected() {
        runOnUiThread(() -> {
            try {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().evaluateJavascript(
                            "if (window.onVibelyScreenshotDetected) { window.onVibelyScreenshotDetected(); } else { window.dispatchEvent(new CustomEvent('vibely_screenshot_captured')); }",
                            null
                    );
                }
            } catch (Exception ignored) {
            }
        });
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (instance == this) {
            instance = null;
        }
        if (screenshotObserver != null) {
            try {
                getContentResolver().unregisterContentObserver(screenshotObserver);
            } catch (Exception ignored) {
            }
        }
    }
}

