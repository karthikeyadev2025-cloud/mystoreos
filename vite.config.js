import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 4_000_000,
        navigateFallback: '/index.html',
        // Force new SW to take control immediately — evicts old cached bundles
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // Navigation: always fetch fresh index.html from network when online
          // so old JS bundles can never be served after a deploy
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'navigation', networkTimeoutSeconds: 5 },
          },
          // Hashed assets: NetworkFirst so new chunk hashes are always fetched
          {
            urlPattern: /\/assets\/.+\.(js|css)$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'hashed-assets', networkTimeoutSeconds: 10 },
          },
        ],
      },
      manifest: {
        name: 'MyStore Business OS',
        short_name: 'MyStore',
        description: 'One Platform. Zero Paper. Infinite Growth.',
        theme_color: '#0f0c29',
        background_color: '#0f0c29',
        display: 'standalone',
        icons: [
          { src: '/logo.png', sizes: '192x192', type: 'image/png' },
          { src: '/logo.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  esbuild: { target: 'es2020' },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Core React runtime — loads on every page
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'react-core';
          // Router
          if (id.includes('node_modules/react-router')) return 'router';
          // Toast notifications
          if (id.includes('node_modules/react-toastify')) return 'toastify';
          // QR Code display (small, load with pages that use it)
          if (id.includes('node_modules/qrcode.react')) return 'qrcode';
          // Supabase client
          if (id.includes('node_modules/@supabase')) return 'supabase';
          // Framer Motion
          if (id.includes('node_modules/framer-motion')) return 'framer';
          // Lucide icons
          if (id.includes('node_modules/lucide-react') || id.includes('node_modules/@lucide')) return 'icons';
        },
      },
    },
    chunkSizeWarningLimit: 650,
  },
})
