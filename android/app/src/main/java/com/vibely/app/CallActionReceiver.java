package com.vibely.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class CallActionReceiver extends BroadcastReceiver {
    private static final String TAG = "CallActionReceiver";

    public static final String ACTION_ANSWER = "com.vibely.app.ACTION_ANSWER_CALL";
    public static final String ACTION_DECLINE = "com.vibely.app.ACTION_DECLINE_CALL";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String action = intent.getAction();

        // 1. Stop background ringtone immediately
        VibelyBackgroundService service = VibelyBackgroundService.getInstance();
        if (service != null) {
            service.stopRinging();
        }

        // 2. Dismiss incoming call notification
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(VibelyBackgroundService.NOTIFICATION_CALL_ID);
        }

        String callId = intent.getStringExtra("callId");
        String conversationId = intent.getStringExtra("conversationId");
        String callerId = intent.getStringExtra("callerId");

        if (ACTION_ANSWER.equals(action)) {
            Log.d(TAG, "Call answered by user via notification action: " + callId);
            Intent appIntent = new Intent(context, MainActivity.class);
            appIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            String targetUrl = "https://vibely-sigma-roan.vercel.app/chat/" + conversationId + "?callAction=answer&callId=" + callId;
            appIntent.setData(Uri.parse(targetUrl));
            appIntent.putExtra("targetUrl", targetUrl);
            appIntent.putExtra("callAction", "answer");
            appIntent.putExtra("callId", callId);
            if (intent.hasExtra("callData")) {
                appIntent.putExtra("callData", intent.getStringExtra("callData"));
            }
            context.startActivity(appIntent);
        } else if (ACTION_DECLINE.equals(action)) {
            Log.d(TAG, "Call declined by user via notification action: " + callId);
            if (callerId != null && !callerId.isEmpty()) {
                // Asynchronously send call_declined signal to Vibely server
                new Thread(() -> {
                    try {
                        URL url = new URL("https://vibely-sigma-roan.vercel.app/api/chat/call-signal");
                        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                        conn.setRequestMethod("POST");
                        conn.setRequestProperty("Content-Type", "application/json");
                        conn.setDoOutput(true);
                        conn.setConnectTimeout(5000);
                        conn.setReadTimeout(5000);

                        JSONObject payload = new JSONObject();
                        payload.put("callId", callId);
                        payload.put("conversationId", conversationId);
                        payload.put("timestamp", System.currentTimeMillis());

                        JSONObject body = new JSONObject();
                        body.put("targetUserId", callerId);
                        body.put("event", "call_declined");
                        body.put("payload", payload);
                        body.put("conversationId", conversationId);

                        try (OutputStream os = conn.getOutputStream()) {
                            os.write(body.toString().getBytes("UTF-8"));
                        }
                        int responseCode = conn.getResponseCode();
                        Log.d(TAG, "Call decline signal sent with status: " + responseCode);
                        conn.disconnect();
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to send call_declined signal", e);
                    }
                }).start();
            }
        }
    }
}
