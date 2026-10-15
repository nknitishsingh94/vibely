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
    const callerName = payload?.caller?.display_name || 'Someone';
    const isVideo = payload?.callType === 'video';

    const pushPayload = JSON.stringify({
      title: isCall
        ? `📞 Incoming ${isVideo ? 'Video' : 'Voice'} Call`
        : (payload?.sender?.display_name || 'Vibely'),
      body: isCall
        ? `${callerName} is calling you on Vibely... Tap to answer`
        : (payload?.body || 'New message'),
      icon: isCall ? (payload?.caller?.avatar_path || '/icon-192.png') : '/icon-192.png',
      badge: '/icon-192.png',
      sound: '/ringtone.wav',
      tag: isCall ? `call-${payload?.callId || Date.now()}` : `msg-${payload?.conversationId || Date.now()}`,
      vibrate: isCall ? [1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500] : [150, 80, 150],
      event,
      payload,
      timestamp: Date.now(),
    });

    const pushOptions: webpush.RequestOptions = {
      urgency: isCall ? 'high' : 'normal',
      TTL: isCall ? 60 : 86400, // Calls expire in 60s, messages expire in 24h
      headers: {
        Urgency: isCall ? 'high' : 'normal',
        Topic: isCall ? 'call' : 'message',
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
