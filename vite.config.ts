import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'NutriMax',
        short_name: 'NutriMax',
        description: 'Treino e nutrição acompanhados por IA',
        lang: 'pt-BR',
        theme_color: '#0a0c0b',
        background_color: '#0a0c0b',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
    }),
  ],
})
