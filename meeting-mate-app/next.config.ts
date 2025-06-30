import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 本番ビルド時のみ静的エクスポートを有効にする
  ...(process.env.NODE_ENV === 'production' && process.env.NEXT_EXPORT === 'true' ? {
    output: 'export',
    trailingSlash: true,
    distDir: 'out',
  } : {
    // 開発環境では動的ルーティングのためのrewritesを設定
    async rewrites() {
      return [
        {
          source: '/room/:roomId',
          destination: '/room',
        },
        // 開発環境でのバックエンドAPIプロキシ（localhost FastAPIへ）
        {
          source: '/invoke',
          destination: 'http://localhost:8000/invoke',
        },
        {
          source: '/join_room',
          destination: 'http://localhost:8000/join_room',
        },
        {
          source: '/approve_join_request',
          destination: 'http://localhost:8000/approve_join_request',
        },
        {
          source: '/create_room',
          destination: 'http://localhost:8000/create_room',
        },
      ];
    },
  }),
  /* config options here */
};

export default nextConfig;
