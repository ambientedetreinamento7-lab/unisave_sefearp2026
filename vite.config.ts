import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registro do service worker é manual (ver PwaController) — só
      // acontece quando o admin liga "App instalável" em Configurações,
      // pra dar pra desligar a instalação pro público sem mexer em deploy.
      injectRegister: false,
      manifest: {
        name: 'UniSave SEFEARP — PDI & Soft Skills',
        short_name: 'UniSave',
        description: 'Plataforma de trilhas de PDI e soft skills da SEFEARP.',
        theme_color: '#373896',
        background_color: '#f5f6f8',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
})
