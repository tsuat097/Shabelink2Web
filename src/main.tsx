import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// PWAの自動更新とリロード設定
registerSW({
  immediate: true,
  onNeedRefresh() {
    // registerType: 'autoUpdate' の環境下で新しいバージョンがアクティブになった際、
    // 自動的に画面をリロードして最新のUI/ロジックを反映させます。
    console.log('🔄 新しいバージョンを検知しました。画面を自動リロードします...');
    window.location.reload();
  },
  onRegisteredSW(swUrl, r) {
    console.log('✅ Service Worker が登録されました', swUrl);
    // アプリを開きっぱなしのユーザー向けに、1時間ごとにバックグラウンドで更新をチェック
    if (r) {
      setInterval(() => {
        console.log('🔄 更新チェックを実行中...');
        r.update();
      }, 60 * 60 * 1000); // 1時間 = 60分 * 60秒 * 1000ミリ秒
    }
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)