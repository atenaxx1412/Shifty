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

// プッシュ通知処理
self.addEventListener('push', (event) => {
  console.log('📱 Push notification received:', event);

  if (event.data) {
    const data = event.data.json();
    console.log('📱 Push data:', data);

    // 通知設定のカスタマイズ
    const options = {
      body: data.body || data.notification?.body || 'Shiftyから新しいメッセージ',
      icon: '/images/pwa-icon-192.png',
      badge: '/images/pwa-icon-192.png',
      tag: data.data?.chatRoomId || data.data?.type || 'general',
      renotify: true,
      requireInteraction: false,
      silent: false,
      vibrate: [200, 100, 200],
      data: {
        ...data.data,
        dateOfArrival: Date.now(),
        url: data.data?.chatRoomId ? `/manager/chat?room=${data.data.chatRoomId}` : '/'
      },
      actions: []
    };

    // 通知タイプ別のアクション設定
    if (data.data?.type === 'chat') {
      options.actions = [
        {
          action: 'open_chat',
          title: '返信',
          icon: '/images/pwa-icon-192.png'
        },
        {
          action: 'mark_read',
          title: '既読にする'
        }
      ];
    } else {
      options.actions = [
        {
          action: 'open',
          title: '確認',
          icon: '/images/pwa-icon-192.png'
        },
        {
          action: 'dismiss',
          title: '閉じる'
        }
      ];
    }

    // バッジ数の更新
    if (data.data?.badge !== undefined) {
      const badgeCount = parseInt(data.data.badge) || 0;
      if ('setAppBadge' in self.navigator) {
        if (badgeCount > 0) {
          self.navigator.setAppBadge(badgeCount);
        } else {
          self.navigator.clearAppBadge();
        }
      }
    }

    event.waitUntil(
      self.registration.showNotification(
        data.title || data.notification?.title || 'Shifty',
        options
      )
    );
  }
});

// 通知クリック処理
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.action, event.notification.data);

  event.notification.close();

  const notificationData = event.notification.data || {};
  let targetUrl = notificationData.url || '/';

  // アクション別の処理
  switch (event.action) {
    case 'open_chat':
    case 'open':
      // チャットを開く、または通常の確認
      break;

    case 'mark_read':
      // 既読にする処理（将来的にはAPIコール）
      console.log('📖 Marking as read:', notificationData.chatRoomId);
      return; // ウィンドウを開かずに終了

    case 'dismiss':
      // 何もしない
      return;

    default:
      // デフォルトアクション（通知自体のクリック）
      break;
  }

  // 既存のクライアントを探してフォーカス、または新しいウィンドウを開く
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // 既存のクライアントを探す
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          // 既存のクライアントをフォーカスして適切なページにナビゲート
          return client.focus().then(() => {
            if (client.navigate && targetUrl !== '/') {
              return client.navigate(targetUrl);
            }
          });
        }
      }

      // 既存のクライアントがない場合は新しいウィンドウを開く
      return clients.openWindow(targetUrl);
    })
  );
});

// バックグラウンド同期（将来の拡張用）
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync:', event.tag);

  if (event.tag === 'background-message-sync') {
    event.waitUntil(
      // メッセージの同期処理
      console.log('📱 Syncing messages in background')
    );
  }
});

// アプリバッジのクリア（アプリがアクティブになった時）
self.addEventListener('message', (event) => {
  console.log('📨 SW Message received:', event.data);

  if (event.data && event.data.type === 'CLEAR_BADGE') {
    if ('clearAppBadge' in self.navigator) {
      self.navigator.clearAppBadge();
    }
  }

  if (event.data && event.data.type === 'UPDATE_BADGE') {
    const count = event.data.count || 0;
    if ('setAppBadge' in self.navigator) {
      if (count > 0) {
        self.navigator.setAppBadge(count);
      } else {
        self.navigator.clearAppBadge();
      }
    }
  }
});