import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command }) => {
  const isProd = command === 'build';

  return {
    // Use /spraff/ base path for production builds (GitHub Pages)
    // Use root path for dev server for simpler local testing with OAuth
    base: isProd ? '/spraff/' : '/',
  server: {
    port: 3001,
    https: {
      key: './key.pem',
      cert: './cert.pem',
    },
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Surrogate-Control': 'no-store',
      'CDN-Cache-Control': 'no-store',
      'Cloudflare-CDN-Cache-Control': 'no-store',
    },
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  plugins: [
    // Only enable PWA in production builds to avoid service worker caching issues in dev
    ...(isProd
      ? [
          VitePWA({
            registerType: 'autoUpdate',
            manifest: {
              name: 'Spraff',
              short_name: 'Spraff',
              description: 'Simple AI voice chat',
              theme_color: '#4F46E5',
              background_color: '#FAFAFA',
              display: 'standalone',
              orientation: 'portrait',
              icons: [
                {
                  src: 'icons/icon-192.png',
                  sizes: '192x192',
                  type: 'image/png',
                },
                {
                  src: 'icons/icon-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                },
                {
                  src: 'icons/icon-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'maskable',
                },
              ],
            },
          }),
        ]
      : []),
  ],
  };
});
