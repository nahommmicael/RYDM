// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'],
      manifest: {
        name: 'RYDM',
        short_name: 'RYDM',
        description: 'R&B Roadtrip Player',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      // PWA im Dev-Server aktivieren (hilft zum Testen)
      devOptions: {
        enabled: true,
        navigateFallback: 'index.html'
      },
      workbox: {
        // Standard: alles aus /dist cachen
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,mp3}'],
      },
    }),
  ],
  server: {
    host: true, // macht den Dev-Server im LAN sichtbar (z. B. 192.168.x.x:5173)
  },
})