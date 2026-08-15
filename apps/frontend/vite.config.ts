import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

/**
 * Vite Development Configuration
 *
 * PORT STRATEGY:
 *   - preferred port: 5174
 *   - strictPort: false → if 5174 is busy, Vite picks next free port (5175, etc.)
 *   - This NEVER errors. You can always run `npm run dev`.
 *
 * CORS & API:
 *   - All /api requests are proxied to the backend on :4000
 *   - Frontend NEVER talks directly to backend (no CORS issues on any port)
 *   - Works regardless of which port Vite picks
 *
 * EMAIL RESET LINKS:
 *   - FRONTEND_URL in apps/backend/.env must match the port Vite actually uses
 *   - Default is 5174. If Vite picks a different port, update FRONTEND_URL in .env
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    strictPort: false, // Never crash — use next available port if 5174 is busy
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
