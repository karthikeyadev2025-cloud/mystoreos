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
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      manifest: {
        name: 'MyStore Business OS',
        short_name: 'MyStore',
        description: 'One Platform. Zero Paper. Infinite Growth.',
        theme_color: '#0f0c29',
        background_color: '#0f0c29',
        display: 'standalone',
        icons: [
          {
            src: 'https://cdn-icons-png.flaticon.com/512/3514/3514491.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'https://cdn-icons-png.flaticon.com/512/3514/3514491.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
