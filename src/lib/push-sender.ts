import webpush from 'web-push';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { env } from './env';

let isVapidConfigured = false;

function ensureVapidConfigured() {
  if (!isVapidConfigured && env.vapidPublicKey && env.vapidPrivateKey) {
    try {
      webpush.setVapidDetails(
        env.vapidSubject || 'mailto:admin@vibely.com',
        env.vapidPublicKey,
        env.vapidPrivateKey
      );
      isVapidConfigured = true;
    } catch (err) {
      console.warn('VAPID setup warning:', err);
    }
  }
}

/**
 * Send real-time high-priority Web Push to wake up user's phone / background service
 */
export async function sendWebPushToUser(targetUserId: string, event: string, payload: any) {
  if (!targetUserId || !env.supabaseServiceRoleKey || !env.supabaseUrl) {
    return;
  }

  ensureVapidConfigured();
  if (!isVapidConfigured) {
    return;
  }

  try {
    const adminClient = createServiceClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    // 1. Fetch user device push subscriptions
    const { data: userData, error: getUserError } = await adminClient.auth.admin.getUserById(targetUserId);
    if (getUserError || !userData?.user) {
      return;
    }

    const currentMetadata = userData.user.user_metadata || {};
    const subscriptions: any[] = Array.isArray(currentMetadata.push_subscriptions)
      ? currentMetadata.push_subscriptions
      : [];

    if (subscriptions.length === 0) {
      return;
    }

    const isCall = event === 'incoming_call';
    const isSecurityAlert = event === 'chat_security_alert';
    const callerName = payload?.caller?.display_name || payload?.userName || 'Someone';
    const isVideo = payload?.callType === 'video';

    let title = 'Vibely';
    let body = 'New notification';
    let urgency: webpush.RequestOptions['urgency'] = 'normal';
    let vibratePattern = [150, 80, 150];
    let tag = `msg-${payload?.conversationId || Date.now()}`;

    if (isCall) {
      title = `📞 Incoming ${isVideo ? 'Video' : 'Voice'} Call`;
      body = `${callerName} is calling you on Vibely... Tap to answer`;
      urgency = 'high';
      vibratePattern = [1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500];
      tag = `call-${payload?.callId || Date.now()}`;
    } else if (isSecurityAlert) {
      const isScreenshot = payload?.type === 'screenshot';
      title = isScreenshot ? '📸 Screenshot Alert' : '🚨 Security Alert';
      body = isScreenshot
        ? `${payload?.userName || 'Partner'} took a screenshot in your chat!`
        : `${payload?.userName || 'Partner'} performed a security action.`;
      urgency = 'high';
      vibratePattern = [200, 100, 200, 100, 400];
      tag = `sec-${payload?.conversationId || Date.now()}`;
    } else if (event === 'new_message') {
      title = payload?.sender?.display_name || 'Vibely';
      body = payload?.body || 'New message';
      urgency = 'high';
      vibratePattern = [150, 80, 150];
      tag = `msg-${payload?.conversationId || Date.now()}`;
    }

    const pushPayload = JSON.stringify({
      title,
      body,
      icon: isCall ? (payload?.caller?.avatar_path || '/icon-192.png') : '/icon-192.png',
      badge: '/icon-192.png',
      sound: '/ringtone.wav',
      tag,
      vibrate: vibratePattern,
      event,
      payload,
      timestamp: Date.now(),
    });

    const pushOptions: webpush.RequestOptions = {
      urgency,
      TTL: isCall ? 60 : (isSecurityAlert ? 3600 : 86400),
      headers: {
        Urgency: urgency,
        Topic: isCall ? 'call' : (isSecurityAlert ? 'security' : 'message'),
      },
    };

    const staleEndpoints: string[] = [];

    // 2. Dispatch to all user devices in parallel
    const pushPromises = subscriptions.map(async sub => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          pushPayload,
          pushOptions
        );
      } catch (err: any) {
        // 404 or 410 means subscription expired on device
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          staleEndpoints.push(sub.endpoint);
        } else {
          console.warn('Web push delivery warning:', err?.message || err);
        }
      }
    });

    await Promise.allSettled(pushPromises);

    // 3. Clean up stale endpoints if any expired
    if (staleEndpoints.length > 0) {
      const activeSubs = subscriptions.filter(s => !staleEndpoints.includes(s.endpoint));
      await adminClient.auth.admin.updateUserById(targetUserId, {
        user_metadata: {
          ...currentMetadata,
          push_subscriptions: activeSubs,
        },
      });
    }
  } catch (err) {
    console.warn('sendWebPushToUser error:', err);
  }
}
