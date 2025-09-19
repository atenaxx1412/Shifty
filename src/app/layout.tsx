import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { DataSharingProvider } from "@/contexts/DataSharingContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Shifty - シフト管理システム",
  description: "効率的なシフト管理とスタッフコミュニケーション",
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
            </DataSharingProvider>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
