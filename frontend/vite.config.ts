import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/idms': {
        target: 'http://mobiledev.advanceagro.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/idms/, '/ws/api/idms')
      },
      '/api/hrms': {
        target: 'http://api-idms.advanceagro.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/hrms/, '/hrms')
      }
    }
  }
})
