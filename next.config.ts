import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable strict mode to prevent double-mounting effects in dev
  reactStrictMode: false,

  // Allow large file uploads (teaching materials, recordings) through proxy
  experimental: {
    proxyClientMaxBodySize: '200mb',
  },

  // Allow dev access from LAN IPs (HTTP + WebSocket HMR)
  allowedDevOrigins: ['192.168.1.33', '192.168.1.34', 'localhost', '127.0.0.1'],

  // Prevent Next.js from bundling pdf-parse (needs worker file that breaks in bundler)
  serverExternalPackages: ['pdf-parse'],

  // CORS headers for API routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      },
      // WASM files need correct MIME type headers
      {
        source: '/mediapipe/:path*',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
