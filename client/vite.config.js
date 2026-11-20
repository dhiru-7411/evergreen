import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Same-origin API in development, matching the production rewrite, so
    // login cookies are first-party.
    proxy: {
      '/api': { target: 'http://localhost:5001', changeOrigin: false },
    },
  },
})
