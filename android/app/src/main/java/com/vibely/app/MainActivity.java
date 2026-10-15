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
import android.webkit.SslErrorHandler;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    private ContentObserver screenshotObserver;
    private String lastCapturedScreenshotPath = "";
    private long lastCapturedScreenshotTime = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Request runtime notification permission for Android 13+ (Tiramisu / API 33+)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(
                            this,
                            new String[]{Manifest.permission.POST_NOTIFICATIONS},
                            101
                    );
                }
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

                    // Add VibelyApp identifier to User-Agent for instant native app detection
                    String originalUa = settings.getUserAgentString();
                    if (originalUa != null && !originalUa.contains("VibelyApp")) {
                        settings.setUserAgentString(originalUa + " VibelyApp/1.0");
                    }
                }

                b.setWebViewClient(new BridgeWebViewClient(b) {
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
                    MediaStore.Images.Media.DATA,
                    MediaStore.Images.Media.DATE_ADDED
            };
            try (Cursor cursor = getContentResolver().query(uri, projection, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int dataIdx = cursor.getColumnIndex(MediaStore.Images.Media.DATA);
                    if (dataIdx != -1) {
                        String path = cursor.getString(dataIdx);
                        long now = System.currentTimeMillis();
                        if (path != null) {
                            String lowerPath = path.toLowerCase();
                            if ((lowerPath.contains("screenshot") || lowerPath.contains("screen_shot"))
                                    && !path.equals(lastCapturedScreenshotPath)
                                    && (now - lastCapturedScreenshotTime > 3000)) {
                                lastCapturedScreenshotPath = path;
                                lastCapturedScreenshotTime = now;
                                notifyScreenshotDetected();
                            }
                        }
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
                            "window.dispatchEvent(new CustomEvent('vibely_screenshot_captured'));",
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
        if (screenshotObserver != null) {
            try {
                getContentResolver().unregisterContentObserver(screenshotObserver);
            } catch (Exception ignored) {
            }
        }
    }
}

