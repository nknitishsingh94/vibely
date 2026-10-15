// Vibely Native Device & Mobile Notification System (Call & Message Notifications)
import { getAudioContext, unlockAudioSession, getSelectedNotificationSound, playSynthesizedNotificationTone } from './ringtone';
import { env } from './env';

// In-memory deduplication cache to prevent duplicate notifications / double chimes
const notifiedKeys = new Map<string, number>();
let lastChimeTime = 0;

function isDuplicateNotification(key: string): boolean {
  const now = Date.now();
  // Clean entries older than 12 seconds
  for (const [k, time] of notifiedKeys.entries()) {
    if (now - time > 12000) {
      notifiedKeys.delete(k);
    }
  }
  if (notifiedKeys.has(key)) {
    return true;
  }
  notifiedKeys.set(key, now);
  return false;
}

/**
 * Play user's preferred message chime with deduplication and silent mode support
 */
export function playMessageNotificationSound(force = false) {
  try {
    if (typeof window === 'undefined') return;

    const now = Date.now();
    // Throttle chimes to prevent double triggers within 600ms
    if (!force && now - lastChimeTime < 600) {
      return;
    }
    lastChimeTime = now;

    const soundPref = getSelectedNotificationSound();
    if (soundPref === 'silent') {
      return; // User set notification sound to silent!
    }

    playSynthesizedNotificationTone(soundPref);
  } catch (err) {
    console.warn('[Vibely Sound] Error playing message chime:', err);
  }
}

/**
 * Check if the browser / mobile supports notifications
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Get current notification permission state
 */
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    return 'denied';
  }

  try {
    if (Notification.permission === 'granted') {
      return 'granted';
    }
    const permission = await Notification.requestPermission();
    return permission;
  } catch {
    return Notification.permission;
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Register device for Background Web Push with VAPID key
 * Ensures keys (p256dh and auth) are extracted correctly for Android Chrome & mobile PWAs
 */
export async function registerPushSubscription(userId: string) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (!isNotificationSupported() || Notification.permission !== 'granted' || !userId) return;

  try {
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      reg = await navigator.serviceWorker.register('/sw.js');
    }

    // Wait for worker ready with timeout
    const readyTimeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 4000));
    await Promise.race([navigator.serviceWorker.ready, readyTimeout]);

    reg = (await navigator.serviceWorker.getRegistration()) || reg;
    if (!reg || !reg.pushManager) return;

    let sub = await reg.pushManager.getSubscription();
    if (sub) {
      const subJson = sub.toJSON ? sub.toJSON() : ({} as any);
      if (!subJson.keys?.p256dh && typeof sub.getKey !== 'function') {
        try {
          await sub.unsubscribe();
          sub = null;
        } catch {}
      }
    }

    if (!sub) {
      const vapidKey = env.vapidPublicKey;
      if (!vapidKey) return false;
      const convertedKey = urlBase64ToUint8Array(vapidKey);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });
    }

    if (sub) {
      // Safely serialize subscription with fallback key extraction
      const subJson = sub.toJSON ? sub.toJSON() : ({} as any);
      let p256dh = subJson.keys?.p256dh;
      let auth = subJson.keys?.auth;

      if (!p256dh && typeof sub.getKey === 'function') {
        const rawP256dh = sub.getKey('p256dh');
        if (rawP256dh) {
          p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawP256dh))));
        }
      }

      if (!auth && typeof sub.getKey === 'function') {
        const rawAuth = sub.getKey('auth');
        if (rawAuth) {
          auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth))));
        }
      }

      const subscriptionData = {
        endpoint: sub.endpoint,
        expirationTime: sub.expirationTime || null,
        keys: {
          p256dh: p256dh || '',
          auth: auth || '',
        },
      };

      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, subscription: subscriptionData }),
      });
      console.log('[Vibely Push] Background push subscription registered successfully for user:', userId);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Failed to register push subscription:', err);
    return false;
  }
}

export interface CallNotificationOptions {
  callerName: string;
  callType: 'voice' | 'video';
  callId: string;
  conversationId?: string;
  avatarUrl?: string | null;
}

/**
 * Show a full Incoming Call notification with continuous vibration on mobile device
 */
export async function showIncomingCallNotification(options: CallNotificationOptions) {
  if (!isNotificationSupported()) return;

  // Request vibration on mobile phone (ringing cadence)
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([1000, 500, 1000, 500, 1000, 500, 1000, 500]);
    } catch {}
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  const title = `📞 Incoming ${options.callType === 'video' ? 'Video' : 'Voice'} Call`;
  const body = `${options.callerName} is calling you on Vibely... Tap to answer`;
  const tag = `call-${options.callId}`;
  const icon = options.avatarUrl || '/icon-192.png';

  try {
    // Try service worker notification first (Required on Android Chrome)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          icon,
          badge: '/icon-192.png',
          tag,
          renotify: true,
          requireInteraction: true,
          vibrate: [1000, 500, 1000, 500, 1000, 500, 1000, 500],
          data: {
            type: 'call',
            callId: options.callId,
            conversationId: options.conversationId,
            url: options.conversationId ? `/chat/${options.conversationId}?callId=${options.callId}` : '/chat',
          },
          actions: [
            { action: 'answer', title: '📞 Answer' },
            { action: 'decline', title: '❌ Decline' },
          ],
        } as any);
        return;
      }
    }

    // Standard Desktop / Web Notification fallback
    new Notification(title, {
      body,
      icon,
      tag,
      requireInteraction: true,
    });
  } catch (err) {
    console.warn('[Vibely Notification] Could not show call notification:', err);
  }
}

/**
 * Dismiss active call notification and cancel vibration
 */
export async function dismissCallNotification(callId?: string) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(0);
    } catch {}
  }

  if (!isNotificationSupported()) return;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const notifications = await reg.getNotifications();
        for (const notif of notifications) {
          if (!callId || notif.tag === `call-${callId}` || notif.tag.startsWith('call-')) {
            notif.close();
          }
        }
      }
    }
  } catch {}
}

export interface MessageNotificationOptions {
  messageId?: string;
  senderName: string;
  messageText?: string | null;
  messageType?: string;
  conversationId: string;
  avatarUrl?: string | null;
}

/**
 * Show a new chat message notification with vibration and chime sound.
 * Guarantees zero duplicate triggers ("do bar notification aane se bachata hai")
 */
export async function showChatMessageNotification(options: MessageNotificationOptions) {
  // Deduplicate against duplicate events (WebSocket + Postgres change + Push)
  const dedupeKey = options.messageId
    ? `msg_${options.messageId}`
    : `chat_${options.conversationId}_${(options.messageText || options.messageType || '').slice(0, 30)}_${options.senderName}`;

  if (isDuplicateNotification(dedupeKey)) {
    return;
  }

  // Play chime sound (respects silence preference & throttling)
  playMessageNotificationSound();

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([120, 80, 120]);
    } catch {}
  }

  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return;
  }

  // Generate preview snippet
  let snippet = options.messageText?.trim() || '';
  if (!snippet) {
    if (options.messageType === 'image') snippet = '📷 Sent a photo';
    else if (options.messageType === 'audio') snippet = '🎤 Voice message';
    else if (options.messageType === 'file') snippet = '📄 Sent a document';
    else snippet = 'Sent a message';
  }

  const title = options.senderName || 'New Message';
  const tag = `msg-${options.conversationId}`;
  const icon = options.avatarUrl || '/icon-192.png';

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body: snippet,
          icon,
          badge: '/icon-192.png',
          tag,
          renotify: true,
          data: {
            type: 'chat',
            conversationId: options.conversationId,
            url: `/chat/${options.conversationId}`,
          },
        } as any);
        return;
      }
    }

    new Notification(title, {
      body: snippet,
      icon,
      tag,
    });
  } catch (err) {
    console.warn('[Vibely Notification] Could not show message notification:', err);
  }
}
