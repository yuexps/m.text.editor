import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      // 代理 HTTP API 请求
      '/api': {
        target: 'http://localhost:3000/app/podnote',
        changeOrigin: true,
      },
      // 代理 WebSocket 监控连接与终端通讯
      '/api/watch/ws': {
        target: 'ws://localhost:3000/app/podnote',
        ws: true,
        changeOrigin: true,
      },
      '/api/terminal/ws': {
        target: 'ws://localhost:3000/app/podnote',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../build/app/www',
    emptyOutDir: true,
  },
})
