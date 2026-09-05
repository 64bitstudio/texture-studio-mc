import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Dev local: el backend mínimo corre aparte en :3000 (ver
    // backend/src/server.ts y docs/README.md). En producción el propio
    // backend sirve este build estático, así que `/api` es same-origin
    // y este proxy no aplica (solo para `npm run dev`).
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
})
