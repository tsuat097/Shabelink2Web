/// <reference types="vite-plugin-pwa/client" />

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/Shabelink2Web/', //
  plugins: [ 
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true // 開発中もPWAの動作を確認できるようにする設定です
      },
      manifest: {
        name: 'Shabelink2 Web',
        short_name: 'Shabelink2',
        description: 'AI Translation & Chat Assistant',
        theme_color: '#ffffff',
        icons: [{
      src: 'icon-192.png',
      sizes: '192x192',
      type: 'image/png'
    },
    {
      src: 'icon-512.png',
      sizes: '512x512',
      type: 'image/png'
    }]
      }
    })
  ]
})