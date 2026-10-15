package com.vibely.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

public class VibelyBackgroundService extends Service {
    private static final String TAG = "VibelyService";

    public static final String CHANNEL_SERVICE = "vibely_service_channel";
    public static final String CHANNEL_CALLS = "vibely_incoming_calls";
    public static final String CHANNEL_MESSAGES = "vibely_messages";

    public static final int NOTIFICATION_SERVICE_ID = 9001;
    public static final int NOTIFICATION_CALL_ID = 9002;
    public static final int NOTIFICATION_MSG_BASE_ID = 9100;

    private static final String SUPABASE_ANON_KEY =
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpZGpmd252b2lkbnNseWlsaGJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTI5OTAsImV4cCI6MjEwNzQ4ODk5MH0.RAae1AyzaIzt_iGn8ZN9F34McN35w_P9zZAmGZZLgjM";
    private static final String SUPABASE_WS_URL =
            "wss://tidjfwnvoidnslyilhbl.supabase.co/realtime/v1/websocket?apikey=" + SUPABASE_ANON_KEY + "&vsn=1.0.0";

    public static volatile boolean isServiceRunning = false;
    private static VibelyBackgroundService instance;

    private String userId;
    private PowerManager.WakeLock wakeLock;
    private OkHttpClient httpClient;
    private WebSocket webSocket;
    private ScheduledExecutorService scheduler;
    private ScheduledFuture<?> heartbeatTask;

    private MediaPlayer ringtonePlayer;
    private Vibrator vibrator;
    private boolean isRinging = false;
    private String activeCallId = null;

    private ConnectivityManager.NetworkCallback networkCallback;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private int reconnectAttempts = 0;
    private boolean isReconnecting = false;

    public static void startService(Context context, String userId) {
        if (userId == null || userId.trim().isEmpty()) return;
        try {
            Intent intent = new Intent(context, VibelyBackgroundService.class);
            intent.putExtra("user_id", userId);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting VibelyBackgroundService", e);
        }
    }

    public static void stopService(Context context) {
        try {
            Intent intent = new Intent(context, VibelyBackgroundService.class);
            context.stopService(intent);
        } catch (Exception e) {
            Log.e(TAG, "Error stopping VibelyBackgroundService", e);
        }
    }

    public static VibelyBackgroundService getInstance() {
        return instance;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        isServiceRunning = true;

        httpClient = new OkHttpClient.Builder()
                .readTimeout(0, TimeUnit.MILLISECONDS)
                .pingInterval(20, TimeUnit.SECONDS)
                .retryOnConnectionFailure(true)
                .build();

        scheduler = Executors.newSingleThreadScheduledExecutor();

        createNotificationChannels();
        acquireWakeLock();
        registerNetworkCallback();

        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && intent.hasExtra("user_id")) {
            userId = intent.getStringExtra("user_id");
            SharedPreferences prefs = getSharedPreferences("vibely_prefs", Context.MODE_PRIVATE);
            prefs.edit().putString("user_id", userId).apply();
        } else if (userId == null) {
            SharedPreferences prefs = getSharedPreferences("vibely_prefs", Context.MODE_PRIVATE);
            userId = prefs.getString("user_id", null);
        }

        Notification notification = buildForegroundNotification();
        try {
            startForeground(NOTIFICATION_SERVICE_ID, notification);
        } catch (Exception e) {
            Log.e(TAG, "startForeground error", e);
        }

        if (userId != null && !userId.isEmpty()) {
            connectWebSocket();
        }

        return START_STICKY;
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            // 1. Silent persistent background service channel
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_SERVICE,
                    "Vibely Background Service",
                    NotificationManager.IMPORTANCE_LOW
            );
            serviceChannel.setDescription("Keeps Vibely connected for background calls & messages");
            serviceChannel.setShowBadge(false);
            serviceChannel.enableVibration(false);
            serviceChannel.setSound(null, null);
            nm.createNotificationChannel(serviceChannel);

            // 2. High-importance Incoming Calls channel
            NotificationChannel callsChannel = new NotificationChannel(
                    CHANNEL_CALLS,
                    "Incoming Calls",
                    NotificationManager.IMPORTANCE_HIGH
            );
            callsChannel.setDescription("High priority ringing and alerts for incoming voice and video calls");
            callsChannel.setShowBadge(true);
            callsChannel.enableVibration(true);
            callsChannel.setVibrationPattern(new long[]{0, 1000, 500, 1000, 500, 1000, 500});
            callsChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            // Try setting ringtone sound for call channel
            try {
                Uri ringtoneUri = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.ringtone);
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .build();
                callsChannel.setSound(ringtoneUri, audioAttributes);
            } catch (Exception ignored) {
                callsChannel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE), null);
            }
            nm.createNotificationChannel(callsChannel);

            // 3. High-importance Messages channel
            NotificationChannel msgChannel = new NotificationChannel(
                    CHANNEL_MESSAGES,
                    "Messages & Notifications",
                    NotificationManager.IMPORTANCE_HIGH
            );
            msgChannel.setDescription("Alerts for incoming chat messages and security alerts");
            msgChannel.setShowBadge(true);
            msgChannel.enableVibration(true);
            msgChannel.setVibrationPattern(new long[]{0, 150, 80, 150});
            msgChannel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
            msgChannel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), null);
            nm.createNotificationChannel(msgChannel);
        }
    }

    private Notification buildForegroundNotification() {
        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(
                this,
                0,
                openAppIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        return new NotificationCompat.Builder(this, CHANNEL_SERVICE)
                .setContentTitle("Vibely")
                .setContentText("Connected • Ready for incoming calls & messages")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pi)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build();
    }

    private synchronized void connectWebSocket() {
        if (userId == null || userId.isEmpty()) return;

        if (webSocket != null) {
            try {
                webSocket.cancel();
            } catch (Exception ignored) {}
            webSocket = null;
        }

        Request request = new Request.Builder()
                .url(SUPABASE_WS_URL)
                .build();

        webSocket = httpClient.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket ws, Response response) {
                Log.d(TAG, "Supabase Realtime WebSocket connected!");
                reconnectAttempts = 0;
                isReconnecting = false;

                // 1. Join call-user channel
                joinChannel(ws, "realtime:call-user:" + userId, "1");
                // 2. Join user-notifications channel
                joinChannel(ws, "realtime:user-notifications:" + userId, "2");

                startHeartbeat();
            }

            @Override
            public void onMessage(WebSocket ws, String text) {
                handleWebSocketMessage(text);
            }

            @Override
            public void onClosing(WebSocket ws, int code, String reason) {
                Log.d(TAG, "WebSocket closing: " + reason);
            }

            @Override
            public void onClosed(WebSocket ws, int code, String reason) {
                Log.d(TAG, "WebSocket closed: " + reason);
                stopHeartbeat();
                scheduleReconnect();
            }

            @Override
            public void onFailure(WebSocket ws, Throwable t, @Nullable Response response) {
                Log.w(TAG, "WebSocket failure: " + t.getMessage());
                stopHeartbeat();
                scheduleReconnect();
            }
        });
    }

    private void joinChannel(WebSocket ws, String topic, String ref) {
        try {
            JSONObject join = new JSONObject();
            join.put("topic", topic);
            join.put("event", "phx_join");
            JSONObject payload = new JSONObject();
            JSONObject config = new JSONObject();
            JSONObject broadcast = new JSONObject();
            broadcast.put("ack", false);
            broadcast.put("self", false);
            config.put("broadcast", broadcast);
            payload.put("config", config);
            join.put("payload", payload);
            join.put("ref", ref);

            ws.send(join.toString());
        } catch (Exception e) {
            Log.e(TAG, "Failed to send phx_join for " + topic, e);
        }
    }

    private void startHeartbeat() {
        stopHeartbeat();
        heartbeatTask = scheduler.scheduleWithFixedDelay(() -> {
            try {
                if (webSocket != null) {
                    JSONObject hb = new JSONObject();
                    hb.put("topic", "phoenix");
                    hb.put("event", "heartbeat");
                    hb.put("payload", new JSONObject());
                    hb.put("ref", "hb_" + System.currentTimeMillis());
                    webSocket.send(hb.toString());
                }
            } catch (Exception ignored) {}
        }, 20, 25, TimeUnit.SECONDS);
    }

    private void stopHeartbeat() {
        if (heartbeatTask != null) {
            heartbeatTask.cancel(true);
            heartbeatTask = null;
        }
    }

    private synchronized void scheduleReconnect() {
        if (isReconnecting) return;
        isReconnecting = true;
        reconnectAttempts++;
        long delay = Math.min((long) Math.pow(2, reconnectAttempts) * 1000L, 15000L);
        mainHandler.postDelayed(() -> {
            if (isServiceRunning && userId != null) {
                connectWebSocket();
            }
        }, delay);
    }

    private void handleWebSocketMessage(String jsonStr) {
        try {
            JSONObject msg = new JSONObject(jsonStr);
            String event = msg.optString("event");
            if (!"broadcast".equals(event)) return;

            JSONObject payloadWrapper = msg.optJSONObject("payload");
            if (payloadWrapper == null) return;

            String subEvent = payloadWrapper.optString("event");
            JSONObject subPayload = payloadWrapper.optJSONObject("payload");
            if (subPayload == null) subPayload = payloadWrapper;

            if ("incoming_call".equals(subEvent)) {
                handleIncomingCall(subPayload);
            } else if ("call_cancelled".equals(subEvent) || "call_ended".equals(subEvent) || "call_declined".equals(subEvent)) {
                handleCallCancelled(subPayload);
            } else if ("new_message".equals(subEvent)) {
                handleNewMessage(subPayload);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error parsing WebSocket message", e);
        }
    }

    private void handleIncomingCall(JSONObject data) {
        String callId = data.optString("callId", "call_" + System.currentTimeMillis());
        activeCallId = callId;
        String callType = data.optString("callType", "voice");
        String conversationId = data.optString("conversationId", "");

        JSONObject caller = data.optJSONObject("caller");
        String callerName = caller != null ? caller.optString("display_name", "Partner") : "Partner";

        // If MainActivity is in foreground, in-app React UI rings and handles the call
        if (MainActivity.isAppInForeground) {
            return;
        }

        // App is in background or phone is locked: play native ringtone and trigger full-screen call notification
        startRinging();

        // 1. PendingIntent for "Answer" action
        Intent answerIntent = new Intent(this, CallActionReceiver.class);
        answerIntent.setAction(CallActionReceiver.ACTION_ANSWER);
        answerIntent.putExtra("callId", callId);
        answerIntent.putExtra("conversationId", conversationId);
        answerIntent.putExtra("callType", callType);
        PendingIntent answerPi = PendingIntent.getBroadcast(
                this,
                101,
                answerIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        // 2. PendingIntent for "Decline" action
        Intent declineIntent = new Intent(this, CallActionReceiver.class);
        declineIntent.setAction(CallActionReceiver.ACTION_DECLINE);
        declineIntent.putExtra("callId", callId);
        declineIntent.putExtra("conversationId", conversationId);
        if (caller != null) {
            declineIntent.putExtra("callerId", caller.optString("id", ""));
        }
        PendingIntent declinePi = PendingIntent.getBroadcast(
                this,
                102,
                declineIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        // 3. Full-screen intent when phone screen is OFF/Locked
        Intent fullScreenIntent = new Intent(this, MainActivity.class);
        fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        String targetUrl = "https://vibely-sigma-roan.vercel.app/chat/" + conversationId + "?callAction=answer&callId=" + callId;
        fullScreenIntent.setData(Uri.parse(targetUrl));
        fullScreenIntent.putExtra("targetUrl", targetUrl);
        PendingIntent fullScreenPi = PendingIntent.getActivity(
                this,
                103,
                fullScreenIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_CALLS)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("📞 Incoming " + ("video".equalsIgnoreCase(callType) ? "Video" : "Voice") + " Call")
                .setContentText(callerName + " is calling you on Vibely...")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setAutoCancel(true)
                .setOngoing(true)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setFullScreenIntent(fullScreenPi, true)
                .setContentIntent(fullScreenPi)
                .addAction(R.mipmap.ic_launcher, "📞 Answer", answerPi)
                .addAction(R.mipmap.ic_launcher, "❌ Decline", declinePi);

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(NOTIFICATION_CALL_ID, builder.build());
        }
    }

    private void handleCallCancelled(JSONObject data) {
        stopRinging();
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(NOTIFICATION_CALL_ID);
        }
    }

    private void handleNewMessage(JSONObject data) {
        // If app is currently open and active in foreground, in-app chat handles it
        if (MainActivity.isAppInForeground) {
            return;
        }

        String conversationId = data.optString("conversationId", "");
        String body = data.optString("body", "New message");
        String messageType = data.optString("messageType", "text");

        JSONObject sender = data.optJSONObject("sender");
        String senderName = sender != null ? sender.optString("display_name", "Vibely") : "Vibely";

        if ("image".equals(messageType)) {
            body = "📷 Sent a photo";
        } else if ("audio".equals(messageType)) {
            body = "🎤 Voice message";
        } else if ("video".equals(messageType)) {
            body = "🎥 Sent a video";
        }

        Intent chatIntent = new Intent(this, MainActivity.class);
        chatIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        String targetUrl = conversationId.isEmpty()
                ? "https://vibely-sigma-roan.vercel.app/chat"
                : "https://vibely-sigma-roan.vercel.app/chat/" + conversationId;
        chatIntent.setData(Uri.parse(targetUrl));
        chatIntent.putExtra("targetUrl", targetUrl);

        PendingIntent pi = PendingIntent.getActivity(
                this,
                (int) System.currentTimeMillis(),
                chatIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_MESSAGES)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(senderName)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
                .setVibrate(new long[]{0, 150, 80, 150});

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            int notifId = NOTIFICATION_MSG_BASE_ID + (int) (System.currentTimeMillis() % 1000);
            nm.notify(notifId, builder.build());
        }
    }

    public synchronized void startRinging() {
        if (isRinging) return;
        isRinging = true;

        try {
            // Play ringtone with looping
            Uri ringtoneUri;
            try {
                ringtoneUri = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.ringtone);
            } catch (Exception e) {
                ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            }

            ringtonePlayer = new MediaPlayer();
            ringtonePlayer.setAudioAttributes(
                    new AudioAttributes.Builder()
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                            .build()
            );
            ringtonePlayer.setDataSource(this, ringtoneUri);
            ringtonePlayer.setLooping(true);
            ringtonePlayer.prepare();
            ringtonePlayer.start();
        } catch (Exception e) {
            Log.e(TAG, "Could not start MediaPlayer ringtone", e);
        }

        // Start ringing vibration
        try {
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = new long[]{0, 1000, 500, 1000, 500, 1000, 500};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 1));
                } else {
                    vibrator.vibrate(pattern, 1);
                }
            }
        } catch (Exception ignored) {}
    }

    public synchronized void stopRinging() {
        isRinging = false;
        if (ringtonePlayer != null) {
            try {
                if (ringtonePlayer.isPlaying()) {
                    ringtonePlayer.stop();
                }
                ringtonePlayer.release();
            } catch (Exception ignored) {}
            ringtonePlayer = null;
        }

        if (vibrator != null) {
            try {
                vibrator.cancel();
            } catch (Exception ignored) {}
        }
    }

    private void acquireWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && wakeLock == null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Vibely::WakeLock");
                wakeLock.acquire(10 * 60 * 1000L); // 10 minutes max safe window
            }
        } catch (Exception ignored) {}
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                wakeLock = null;
            }
        } catch (Exception ignored) {}
    }

    private void registerNetworkCallback() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return;

            NetworkRequest request = new NetworkRequest.Builder()
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    .build();

            networkCallback = new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(Network network) {
                    Log.d(TAG, "Network became available, ensuring WebSocket connected...");
                    if (userId != null && !userId.isEmpty()) {
                        connectWebSocket();
                    }
                }
            };

            cm.registerNetworkCallback(request, networkCallback);
        } catch (Exception ignored) {}
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isServiceRunning = false;
        instance = null;

        stopRinging();
        stopHeartbeat();

        if (webSocket != null) {
            try {
                webSocket.close(1000, "Service destroyed");
            } catch (Exception ignored) {}
            webSocket = null;
        }

        if (scheduler != null) {
            scheduler.shutdownNow();
        }

        try {
            if (networkCallback != null) {
                ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
                if (cm != null) cm.unregisterNetworkCallback(networkCallback);
            }
        } catch (Exception ignored) {}

        releaseWakeLock();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
