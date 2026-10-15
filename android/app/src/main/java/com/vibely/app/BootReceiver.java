package com.vibely.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            Log.d(TAG, "Device booted or app replaced, checking for logged-in user to start VibelyBackgroundService...");
            SharedPreferences prefs = context.getSharedPreferences("vibely_prefs", Context.MODE_PRIVATE);
            String userId = prefs.getString("user_id", null);
            if (userId != null && !userId.trim().isEmpty()) {
                Log.d(TAG, "Starting VibelyBackgroundService for user: " + userId);
                VibelyBackgroundService.startService(context, userId);
            }
        }
    }
}
