import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';

// Check if SSL certificates exist for HTTPS
const httpsConfig =
  fs.existsSync('./key.pem') && fs.existsSync('./cert.pem')
    ? {
        key: fs.readFileSync('./key.pem'),
        cert: fs.readFileSync('./cert.pem'),
      }
    : undefined;

// Disable PWA in development to avoid service worker caching issues
const isDev = process.env.NODE_ENV !== 'production';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './index.html',
      },
    },
  },
  server: {
    port: 3001,
    host: true, // Expose to network for mobile testing
    allowedHosts: true,
    https: httpsConfig, // Enable HTTPS if certificates exist
    headers: {
      // Aggressively disable caching for development (including Cloudflare edge)
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Surrogate-Control': 'no-store',
      'CDN-Cache-Control': 'no-store',
      'Cloudflare-CDN-Cache-Control': 'no-store',
    },
  },
  plugins: [
    !isDev && VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Cache VAD library and ONNX runtime from CDN for offline use
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/onnxruntime-web/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'onnx-runtime-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/@ricky0123\/vad-web/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'vad-library-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      manifest: {
        name: 'Spraff',
        short_name: 'Spraff',
        description: 'Simple AI voice chat',
        theme_color: '#4F46E5',
        background_color: '#1C1C21',
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
        ],
      },
    }),
  ].filter(Boolean),
});
