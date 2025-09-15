import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TypeScript設定
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // ESLint設定  
  eslint: {
    ignoreDuringBuilds: false,
  },
  
  // パフォーマンス最適化
  poweredByHeader: false,
  compress: true,
  
  // 開発環境での安定性向上
  reactStrictMode: true,
  
  // ファイル変更検出の最適化
  webpack: (config) => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
      ignored: /node_modules/,
    }
    return config
  },
};

export default nextConfig;
