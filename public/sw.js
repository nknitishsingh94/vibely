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
  const targetUrl = data.url || (data.conversationId ? `/chat/${data.conversationId}` : '/chat');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
        }
        if (data.type === 'call' && event.action === 'decline') {
          client.postMessage({ type: 'CALL_DECLINE', callId: data.callId });
        } else if (data.type === 'call' && event.action === 'answer') {
          client.postMessage({ type: 'CALL_ANSWER', callId: data.callId });
        } else if (data.type === 'call') {
          client.postMessage({ type: 'CALL_NOTIFICATION_CLICK', callId: data.callId });
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
