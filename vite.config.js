import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Stamped into the build so the running app can show exactly which build
// is live — settles "is my fix actually deployed yet" without guessing
// from screenshots or timestamps. Shown in Settings footer.
const BUILD_STAMP = new Date().toISOString()

export default defineConfig({
  define: {
    __BUILD_STAMP__: JSON.stringify(BUILD_STAMP),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      workbox: {
        globPatterns: ['**/*.{ico,png,svg,webmanifest}'],
        globIgnores: ['**/assets/**', '**/index.html'],
        maximumFileSizeToCacheInBytes: 4_000_000,
        navigateFallback: null,
        navigateFallbackDenylist: [],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'navigation', networkTimeoutSeconds: 3, expiration: { maxEntries: 4 } },
          },
          {
            urlPattern: /\/assets\/.+\.(js|css)$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'hashed-assets', networkTimeoutSeconds: 5, expiration: { maxEntries: 60 } },
          },
        ],
      },
      manifest: {
        name: 'MyStore Business OS',
        short_name: 'MyStore OS',
        description: "India's fastest billing & inventory OS for retail shops",
        theme_color: '#0f172a',
        background_color: '#030712',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'en-IN',
        categories: ['business', 'productivity', 'finance'],
        icons: [
          { src: '/logo.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        shortcuts: [
          { name: 'New Bill', short_name: 'Bill', description: 'Open POS to create a new bill', url: '/dashboard?tab=home', icons: [{ src: '/logo.png', sizes: '192x192' }] },
          { name: 'Products', short_name: 'Products', description: 'View inventory', url: '/dashboard?tab=products', icons: [{ src: '/logo.png', sizes: '192x192' }] },
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
    assetsDir: 'assets',
    rollupOptions: {
      output: {
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
            if (id.includes('/@capacitor') || id.includes('/@capgo')) return 'capacitor';
            return;
          }
          if (id.includes('/src/pages/ShopDashboard'))        return 'dashboard-shop';
          if (id.includes('/src/pages/AdminDashboard'))       return 'dashboard-admin';
          if (id.includes('/src/pages/DistributorDashboard')) return 'dashboard-dist';
          if (id.includes('/src/pages/UserDashboard'))        return 'dashboard-user';
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
})
