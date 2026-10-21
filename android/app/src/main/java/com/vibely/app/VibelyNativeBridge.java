package com.vibely.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import android.webkit.JavascriptInterface;

public class VibelyNativeBridge {
    private static final String TAG = "VibelyNativeBridge";
    private final Activity activity;

    public VibelyNativeBridge(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public void onUserLoggedIn(String userId, String username, String displayName) {
        if (userId == null || userId.trim().isEmpty()) return;
        Log.d(TAG, "Native Bridge: User logged in -> " + userId + " (" + username + ")");
        try {
            SharedPreferences prefs = activity.getSharedPreferences("vibely_prefs", Context.MODE_PRIVATE);
            prefs.edit()
                    .putString("user_id", userId)
                    .putString("username", username != null ? username : "")
                    .putString("display_name", displayName != null ? displayName : "")
                    .apply();

            VibelyBackgroundService.startService(activity, userId);
        } catch (Exception e) {
            Log.e(TAG, "Error in onUserLoggedIn", e);
        }
    }

    @JavascriptInterface
    public void onUserLoggedOut() {
        Log.d(TAG, "Native Bridge: User logged out");
        try {
            SharedPreferences prefs = activity.getSharedPreferences("vibely_prefs", Context.MODE_PRIVATE);
            prefs.edit().clear().apply();
            VibelyBackgroundService.stopService(activity);
        } catch (Exception e) {
            Log.e(TAG, "Error in onUserLoggedOut", e);
        }
    }

    @JavascriptInterface
    public void stopRingtone() {
        try {
            VibelyBackgroundService service = VibelyBackgroundService.getInstance();
            if (service != null) {
                service.stopRinging();
            }
        } catch (Exception ignored) {}
    }

    @JavascriptInterface
    public String getSavedUserId() {
        SharedPreferences prefs = activity.getSharedPreferences("vibely_prefs", Context.MODE_PRIVATE);
        return prefs.getString("user_id", "");
    }

    @JavascriptInterface
    public String getPendingIncomingCall() {
        String pending = MainActivity.lastPendingCallJson;
        MainActivity.lastPendingCallJson = null;
        return pending != null ? pending : "";
    }

    @JavascriptInterface
    public boolean isNativeApp() {
        return true;
    }

    @JavascriptInterface
    public void requestIgnoreBatteryOptimizations() {
        activity.runOnUiThread(() -> {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    Intent intent = new Intent();
                    String packageName = activity.getPackageName();
                    PowerManager pm = (PowerManager) activity.getSystemService(Context.POWER_SERVICE);
                    if (pm != null && !pm.isIgnoringBatteryOptimizations(packageName)) {
                        intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                        intent.setData(Uri.parse("package:" + packageName));
                        activity.startActivity(intent);
                    }
                }
            } catch (Exception e) {
                try {
                    Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                    activity.startActivity(intent);
                } catch (Exception ignored) {}
            }
        });
    }

    @JavascriptInterface
    public void downloadFile(String url, String filename, String mimeType) {
        if (url == null || url.trim().isEmpty()) return;
        activity.runOnUiThread(() -> {
            try {
                String safeFilename = filename != null && !filename.trim().isEmpty() 
                        ? filename.trim() 
                        : "vibely_download_" + System.currentTimeMillis();

                Uri downloadUri = Uri.parse(url);
                android.app.DownloadManager.Request request = new android.app.DownloadManager.Request(downloadUri);

                if (mimeType != null && !mimeType.trim().isEmpty()) {
                    request.setMimeType(mimeType.trim());
                }

                request.setTitle(safeFilename);
                request.setDescription("Downloading file to Files...");
                request.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_DOWNLOADS, safeFilename);

                android.app.DownloadManager dm = (android.app.DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(request);
                    android.widget.Toast.makeText(activity, "Downloading " + safeFilename + " to Files...", android.widget.Toast.LENGTH_SHORT).show();
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to download file via DownloadManager", e);
                try {
                    android.widget.Toast.makeText(activity, "Download failed: " + e.getMessage(), android.widget.Toast.LENGTH_LONG).show();
                } catch (Exception ignored) {}
            }
        });
    }
}
