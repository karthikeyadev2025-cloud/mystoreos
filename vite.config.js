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
        // Don't precache heavy on-demand chunks — let them be network-fetched and browser-cached
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /\.(?:js|css)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'static-assets', expiration: { maxAgeSeconds: 7 * 24 * 60 * 60 } },
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
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Core React runtime — loads on every page
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'react-core';
          // Router
          if (id.includes('node_modules/react-router')) return 'router';
          // Toast notifications
          if (id.includes('node_modules/react-toastify')) return 'toastify';
          // PDF generation — loaded only on billing
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) return 'pdf-libs';
          // QR Code display (small, load with pages that use it)
          if (id.includes('node_modules/qrcode.react')) return 'qrcode';
          // Barcode rendering
          if (id.includes('node_modules/react-barcode') || id.includes('node_modules/jsbarcode')) return 'barcode';
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
