import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { DataSharingProvider } from "@/contexts/DataSharingContext";
import PWAInstaller from "@/components/PWAInstaller";
import NotificationSetup from "@/components/notifications/NotificationSetup";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#fb923c",
  colorScheme: "light dark", // ダークモード対応
  viewportFit: "cover",      // iPhone Xノッチ対応
};

export const metadata: Metadata = {
  title: "Shifty - シフト管理システム",
  description: "効率的なシフト管理とスタッフコミュニケーション",
  keywords: ["シフト管理", "勤怠管理", "スケジュール管理", "チャット", "Excel出力"],
  authors: [{ name: "Shifty Team" }],
  creator: "Shifty Inc.",
  publisher: "Shifty Inc.",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "Shifty - シフト管理システム",
    description: "効率的なシフト管理とスタッフコミュニケーション",
    url: "https://shifty.app",
    siteName: "Shifty",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shifty - シフト管理システム",
    description: "効率的なシフト管理とスタッフコミュニケーション",
    creator: "@shifty_app",
  },
  manifest: "/manifest.json",
  formatDetection: {
    telephone: false,    // 電話番号の自動リンク化を防ぐ
    date: false,        // 日付の自動リンク化を防ぐ
    address: false,     // 住所の自動リンク化を防ぐ
    email: false,       // メールの自動リンク化を防ぐ
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Shifty",
    startupImage: [     // スプラッシュスクリーン追加
      {
        url: "/images/pwa-icon-512.png",
        media: "(device-width: 768px) and (device-height: 1024px)"
      }
    ],
  },
  icons: {
    icon: [
      { url: "/images/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/images/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/images/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/images/pwa-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/images/favicon-32x32.png",
    apple: [
      { url: "/images/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "msapplication-TileColor": "#fb923c",
    "msapplication-config": "none",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <AuthProvider>
          <NotificationProvider>
            <DataSharingProvider>
              {children}
              <PWAInstaller />
              <NotificationSetup />
            </DataSharingProvider>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
