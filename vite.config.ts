import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 允许所有 IP 访问
    host: true, // 等价于 host: '0.0.0.0'
    port: 8501,
    watch: {
      usePolling: false,
      interval: 1000
    },
    logLevel: 'debug',
    hmr: {
      overlay: true, // 显示错误覆盖层
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  logLevel: 'debug',
})
