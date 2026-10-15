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
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private ContentObserver screenshotObserver;
    private String lastCapturedScreenshotPath = "";
    private long lastCapturedScreenshotTime = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Request runtime notification permission for Android 13+ (Tiramisu / API 33+)
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

        // 2. Android 14+ (API 34+) Native Official ScreenCaptureCallback
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            registerScreenCaptureCallback(getMainExecutor(), new ScreenCaptureCallback() {
                @Override
                public void onScreenCaptured() {
                    notifyScreenshotDetected();
                }
            });
        }

        // 3. Fallback ContentObserver for Android 10-13 (Detects screenshot saved to storage)
        registerScreenshotObserver();
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

