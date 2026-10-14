// Vibely Native Device & Mobile Notification System (Call & Message Notifications)

let messageAudioCtx: AudioContext | null = null;

/**
 * Play a pleasant mobile message chime using Web Audio API
 */
export function playMessageNotificationSound() {
  try {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!messageAudioCtx || messageAudioCtx.state === 'closed') {
      messageAudioCtx = new AudioContextClass();
    }
    if (messageAudioCtx.state === 'suspended') {
      messageAudioCtx.resume().catch(() => {});
    }

    const ctx = messageAudioCtx;
    const now = ctx.currentTime;

    // Pleasant dual chime (C6 -> G6)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046.5, now); // C6
    osc1.frequency.exponentialRampToValueAtTime(1567.98, now + 0.12); // G6

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(523.25, now); // C5 harmonic
    osc2.frequency.exponentialRampToValueAtTime(783.99, now + 0.12);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.4);
    osc2.stop(now + 0.4);
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

interface CallNotificationOptions {
  callerName: string;
  callType: 'voice' | 'video';
  callId: string;
  conversationId?: string;
  avatarUrl?: string | null;
}

/**
 * Show a full Incoming Call notification with vibration on mobile device
 */
export async function showIncomingCallNotification(options: CallNotificationOptions) {
  if (!isNotificationSupported()) return;

  // Request vibration on mobile phone (ringing cadence)
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([600, 400, 600, 400, 600, 400, 600, 400]);
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
          vibrate: [600, 400, 600, 400, 600, 400],
          data: {
            type: 'call',
            callId: options.callId,
            conversationId: options.conversationId,
            url: options.conversationId ? `/chat/${options.conversationId}` : '/chat',
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

interface MessageNotificationOptions {
  senderName: string;
  messageText?: string | null;
  messageType?: string;
  conversationId: string;
  avatarUrl?: string | null;
}

/**
 * Show a new chat message notification with vibration and chime sound
 */
export async function showChatMessageNotification(options: MessageNotificationOptions) {
  // Always play chime sound and short mobile vibration
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
