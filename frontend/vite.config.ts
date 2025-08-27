import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 开发服务器配置
    port: 5173,
    host: '0.0.0.0',
    // API代理配置 - 解决CORS问题
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
        ws: true,
      }
    }
  }
})
