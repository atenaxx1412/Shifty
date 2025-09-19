const CACHE_NAME = 'shifty-v1.0.0';
const urlsToCache = [
  '/',
  '/offline',
  '/manifest.json',
  '/images/pwa-icon-192.png',
  '/images/pwa-icon-512.png',
  '/images/logo-only-transparent.png',
];

// インストール時のキャッシュ処理
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// アクティベート時の古いキャッシュ削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// フェッチ処理：ネットワーク優先、フォールバックでキャッシュ
self.addEventListener('fetch', (event) => {
  // 非GET リクエストは無視
  if (event.request.method !== 'GET') {
    return;
  }

  // Firebase Auth関連のリクエストは常にネットワーク経由
  if (event.request.url.includes('firebase') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('identitytoolkit')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // レスポンスが有効な場合のみキャッシュ
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // レスポンスをクローンしてキャッシュに保存
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });

        return response;
      })
      .catch(() => {
        // ネットワークエラー時はキャッシュから取得
        return caches.match(event.request)
          .then((response) => {
            if (response) {
              return response;
            }

            // HTMLページの場合はオフラインページにリダイレクト
            if (event.request.destination === 'document') {
              return caches.match('/offline');
            }

            return new Response('Network error happened', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' },
            });
          });
      })
  );
});

// プッシュ通知処理（将来の拡張用）
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/images/pwa-icon-192.png',
      badge: '/images/pwa-icon-192.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '1'
      },
      actions: [
        {
          action: 'explore',
          title: '確認',
          icon: '/images/pwa-icon-192.png'
        },
        {
          action: 'close',
          title: '閉じる'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// 通知クリック処理
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});