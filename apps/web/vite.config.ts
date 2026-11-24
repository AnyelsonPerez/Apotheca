import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/cima': 'http://127.0.0.1:8000',
      '/inventory': 'http://127.0.0.1:8000',
      '/settings': 'http://127.0.0.1:8000',
      '/alerts': 'http://127.0.0.1:8000',
    },
  },
})
