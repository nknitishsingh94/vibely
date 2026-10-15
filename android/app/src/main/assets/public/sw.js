// Vibely Progressive Web App Service Worker
const CACHE_NAME = 'vibely-v1';

// Assets to precache for offline shell
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/ringtone.wav',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[Vibely SW] Precache partial error:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Bypass API calls, Supabase requests, and WebSockets completely
  if (
    url.pathname.startsWith('/api') ||
    url.hostname.includes('supabase') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:'
  ) {
    return;
  }

  // Network-first strategy for dynamic pages and API content
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache valid static responses
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic' &&
          (url.pathname.startsWith('/_next/static') ||
           url.pathname.endsWith('.png') ||
           url.pathname.endsWith('.svg') ||
           url.pathname.endsWith('.ico') ||
           url.pathname.endsWith('.woff2'))
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Fallback to cache if network fails
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // If navigation request fails, return cached root or offline fallback
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }

        return new Response('Network error occurred', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' }),
        });
      })
  );
});

// Handle notification clicks (Mobile & Desktop)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let targetUrl = data.url || (data.conversationId ? `/chat/${data.conversationId}` : '/chat');

  if (data.type === 'call') {
    const isAnswer = event.action === 'answer' || !event.action;
    const queryJoin = targetUrl.includes('?') ? '&' : '?';
    targetUrl += `${queryJoin}callAction=${isAnswer ? 'answer' : 'decline'}&callId=${data.callId || ''}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus and navigate it
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
        }
        if ('navigate' in client && targetUrl) {
          client.navigate(targetUrl);
        }
        if (data.type === 'call') {
          if (event.action === 'decline') {
            client.postMessage({ type: 'CALL_DECLINE', callId: data.callId });
          } else {
            client.postMessage({ type: 'CALL_ANSWER', callId: data.callId });
          }
        } else {
          client.postMessage({ type: 'NOTIFICATION_CLICK', data });
        }
        return;
      }
      // If no window is open, open a new window to target URL
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data || {};
  if (data.type === 'call') {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      clientList.forEach((client) => {
        client.postMessage({ type: 'CALL_NOTIFICATION_DISMISSED', callId: data.callId });
      });
    });
  }
});

// Background OS Push Wake-up (Handles calls and messages when phone is locked or app is closed)
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Vibely', body: event.data ? event.data.text() : '' };
  }

  const eventType = data.event || data.type;
  const payload = data.payload || {};

  if (eventType === 'incoming_call') {
    const callerName = payload.caller?.display_name || 'Someone';
    const isVideo = payload.callType === 'video';
    const title = `📞 Incoming ${isVideo ? 'Video' : 'Voice'} Call`;
    const body = `${callerName} is calling you on Vibely... Tap to answer`;

    const options = {
      body,
      icon: payload.caller?.avatar_path || '/icon-192.png',
      badge: '/icon-192.png',
      tag: `call-${payload.callId || 'active'}`,
      renotify: true,
      requireInteraction: true,
      vibrate: [1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500],
      sound: '/ringtone.wav',
      data: {
        type: 'call',
        callId: payload.callId,
        conversationId: payload.conversationId,
        url: payload.conversationId ? `/chat/${payload.conversationId}` : '/chat',
      },
      actions: [
        { action: 'answer', title: '📞 Answer' },
        { action: 'decline', title: '❌ Decline' },
      ],
    };

    // Forward to any background clients to start instant ringtone playback
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      clientList.forEach((client) => {
        client.postMessage({ type: 'BACKGROUND_INCOMING_CALL', payload });
      });
    });

    event.waitUntil(self.registration.showNotification(title, options));
  } else if (eventType === 'call_cancelled') {
    event.waitUntil(
      self.registration.getNotifications().then((notifications) => {
        notifications.forEach((n) => {
          if (n.tag && n.tag.startsWith('call-')) {
            n.close();
          }
        });
      })
    );
  } else if (eventType === 'new_message') {
    const senderName = payload.sender?.display_name || 'New Message';
    let snippet = payload.body || '';
    if (!snippet) {
      if (payload.messageType === 'image') snippet = '📷 Sent a photo';
      else if (payload.messageType === 'audio') snippet = '🎤 Voice message';
      else snippet = 'Sent a message';
    }

    const options = {
      body: snippet,
      icon: payload.sender?.avatar_path || '/icon-192.png',
      badge: '/icon-192.png',
      tag: `msg-${payload.conversationId || Date.now()}`,
      renotify: true,
      vibrate: [150, 80, 150],
      data: {
        type: 'chat',
        conversationId: payload.conversationId,
        url: payload.conversationId ? `/chat/${payload.conversationId}` : '/chat',
      },
    };

    event.waitUntil(self.registration.showNotification(senderName, options));
  } else if (eventType === 'chat_security_alert') {
    const userName = payload.userName || 'Partner';
    const isScreenshot = payload.type === 'screenshot';
    const title = isScreenshot ? '📸 Screenshot Alert' : '🚨 Security Alert';
    const body = isScreenshot
      ? `${userName} took a screenshot in your chat!`
      : `${userName} performed a security action.`;

    const options = {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `sec-${payload.conversationId || Date.now()}`,
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 400],
      sound: '/ringtone.wav',
      data: {
        type: 'security_alert',
        conversationId: payload.conversationId,
        url: payload.conversationId ? `/chat/${payload.conversationId}` : '/chat',
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } else {
    // Universal fallback: never let an incoming push be silently ignored
    const fallbackTitle = data.title || 'Vibely';
    const fallbackBody = data.body || 'You have a new update';
    const options = {
      body: fallbackBody,
      icon: data.icon || '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [150, 80, 150],
      data: data.data || data,
    };
    event.waitUntil(self.registration.showNotification(fallbackTitle, options));
  }
});

