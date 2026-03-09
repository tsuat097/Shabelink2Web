import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
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
        icons: [] // ※アイコン画像は後で追加するので、今は空で大丈夫です
      }
    })
  ]
})