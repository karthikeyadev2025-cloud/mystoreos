import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      workbox: {
        // Precache only static assets, NOT html — html is handled by the
        // NetworkFirst navigation rule below so a new deploy is always picked up
        // without a hard refresh. (Precaching index.html made it cache-first,
        // which defeated NetworkFirst and is why updates needed a manual refresh.)
        globPatterns: ['**/*.{js,css,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 4_000_000,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /supabase/],
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
            options: { cacheName: 'navigation', networkTimeoutSeconds: 3 },
          },
          // Hashed assets: NetworkFirst so new chunk hashes are always fetched
          {
            urlPattern: /\/assets\/.+\.(js|css)$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'hashed-assets', networkTimeoutSeconds: 5 },
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
  esbuild: {
    target: 'es2020',
    drop: ['console', 'debugger'],
    pure: ['console.log', 'console.warn', 'console.error', 'console.info', 'console.debug', 'console.trace'],
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        // Hybrid: explicit vendor splits (object form) + a function fallback so dashboards
        // that are already lazy-imported still get their own named chunks.
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('/react-router')) return 'vendor-react';
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react';
            if (id.includes('/recharts')) return 'vendor-charts';
            if (id.includes('/framer-motion')) return 'vendor-ui';
            if (id.includes('/lucide-react') || id.includes('/@lucide')) return 'vendor-ui';
            if (id.includes('/jspdf') || id.includes('/html2canvas')) return 'vendor-pdf';
            if (id.includes('/@supabase')) return 'supabase';
            if (id.includes('/react-toastify')) return 'toastify';
            if (id.includes('/qrcode.react')) return 'qrcode';
            return;
          }
          if (id.includes('/src/pages/ShopDashboard'))        return 'dashboard-shop';
          if (id.includes('/src/pages/AdminDashboard'))       return 'dashboard-admin';
          if (id.includes('/src/pages/DistributorDashboard')) return 'dashboard-dist';
          if (id.includes('/src/pages/UserDashboard'))        return 'dashboard-user';
        },
      },
    },
    chunkSizeWarningLimit: 650,
  },
})
