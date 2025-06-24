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
    // �������� IP ����
    host: true, // �ȼ��� host: '0.0.0.0'
    port: 8501,
    watch: {
      usePolling: false,
      interval: 1000
    },
    logLevel: 'debug',
    hmr: {
      overlay: true, // ��ʾ���󸲸ǲ�
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  logLevel: 'debug',
})
