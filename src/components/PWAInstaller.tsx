'use client';

import { useEffect } from 'react';

export default function PWAInstaller() {
  useEffect(() => {
    // Service Workerの登録
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('SW registered: ', registration);
          })
          .catch((registrationError) => {
            console.log('SW registration failed: ', registrationError);
          });
      });
    }

    // PWAインストールプロンプトの処理
    let deferredPrompt: any;

    window.addEventListener('beforeinstallprompt', (e) => {
      // デフォルトのインストールプロンプトを防ぐ
      e.preventDefault();
      // イベントを保存（後で使用するため）
      deferredPrompt = e;

      // カスタムインストールボタンを表示するロジック（必要に応じて）
      console.log('PWA install prompt ready');
    });

    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed');
      deferredPrompt = null;
    });

    // iOSでのPWAホーム画面追加促進（必要に応じて）
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone;

    if (isIOS && !isInStandaloneMode) {
      // iOS用のカスタムインストール案内を表示するロジック（必要に応じて）
      console.log('iOS PWA install guidance available');
    }
  }, []);

  return null; // このコンポーネントは何もレンダリングしない
}