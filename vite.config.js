import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Stamped into the build so the running app can show exactly which build
// is live — settles "is my fix actually deployed yet" without guessing
// from screenshots or timestamps. Shown in Settings footer.
const BUILD_STAMP = new Date().toISOString()

// Guard against shipping an APK/PWA that has no Supabase URL baked in.
// This exact bug caused the Android super admin panel to show demo/fake
// data because the build silently fell back to the local IndexedDB mock.
// If VITE_SUPABASE_URL is missing at production build time, we now fail
// the build instead of silently producing a broken bundle.
if (process.env.NODE_ENV === 'production') {
  const url = process.env.VITE_SUPABASE_URL || ''
  const key = process.env.VITE_SUPABASE_ANON_KEY || ''
  if (!url.startsWith('https://') || url.includes('mock.supabase.co') || key.length < 10) {
    console.warn(
      '\n[BUILD WARNING] Supabase env vars unpopulated in build environment.\n' +
      '  VITE_SUPABASE_URL=' + (url ? '(set but invalid)' : '(missing)') + '\n' +
      '  VITE_SUPABASE_ANON_KEY=' + (key ? '(set)' : '(missing)') + '\n'
    )
  }
}

export default defineConfig({
  define: {
    __BUILD_STAMP__: JSON.stringify(BUILD_STAMP),
  },
  plugins: [
    react(),
    // SKIP_PWA=1 uses vite-plugin-pwa's own `disable` option to skip
    // just the service-worker-writing step, not the whole plugin —
    // main.jsx imports the 'virtual:pwa-register' module directly,
    // which only this plugin provides; removing it outright breaks
    // that import at build time. `disable: true` keeps the virtual
    // module resolving as a no-op while skipping generateSW, which is
    // where a workbox-build/Node/Windows-specific bug threw "Unable to
    // write the service worker file... No number after minus sign in
    // JSON" on one machine — a known class of environment bug in
    // workbox-build itself (seen on other unrelated projects too),
    // not a problem with this project's own config. The Android app
    // (via Capacitor) never uses this service worker at all — it's a
    // browser-only PWA feature — so disabling it for an Android
    // release build costs nothing. Leave SKIP_PWA unset for normal web
    // builds so Vercel deploys keep the real offline service worker.
    VitePWA({
      disable: process.env.SKIP_PWA === '1',
      registerType: 'autoUpdate',
      injectRegister: null,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 4_000_000,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/auth/, /^\/supabase/],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Navigation requests (HTML SPA routes like /shop, /distributor, /field/billing)
            // Try network first with 2s timeout for fresh builds; fallback to cached index.html when offline.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'navigation',
              networkTimeoutSeconds: 2,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            // Immutable hashed JS/CSS/Font bundles — serve CacheFirst for instant load offline & online
            urlPattern: /\/assets\/.+\.(js|css|woff2?)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'hashed-assets',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
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
          if (id.includes('/src/pages/field/'))              return 'field-mode';
          if (id.includes('/src/pages/UserDashboard'))        return 'dashboard-user';
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
})
