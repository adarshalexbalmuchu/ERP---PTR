import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // App shell (JS/CSS/HTML) is precached so the app itself opens
      // offline. Supabase API responses are cached separately at runtime
      // (GET only — Workbox never caches mutating requests) so a guard can
      // still see their last-loaded tasks with no signal.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/rest/v1/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ptr-api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        name: 'Palamu Tiger Reserve — Tiger Cell',
        short_name: 'PTR Tiger Cell',
        description: 'Task management for Palamu Tiger Reserve field operations',
        theme_color: '#1A4731',
        background_color: '#F5F1E8',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
})
