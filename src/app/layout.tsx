import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { DataSharingProvider } from "@/contexts/DataSharingContext";
import PWAInstaller from "@/components/PWAInstaller";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Shifty - シフト管理システム",
  description: "効率的なシフト管理とスタッフコミュニケーション",
  manifest: "/manifest.json",
  themeColor: "#3b82f6",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Shifty",
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
    "msapplication-TileColor": "#3b82f6",
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
            </DataSharingProvider>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
