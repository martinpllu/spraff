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
    port: 3001, // Match Cloudflare tunnel config
    host: true, // Expose to network for Cloudflare tunnel
    allowedHosts: true, // Allow any host (for Cloudflare tunnel)
    headers: {
      'Cache-Control': 'no-store', // Disable caching for development
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
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
  ],
});
